import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\n/g, "
"),
    }),
  });
}

const db = admin.firestore();

async function findClick(clickId) {
  const collections = ["click_logs", "clicks"];
  const fields = ["trackingId", "clickId", "click_id", "subid", "subId"];

  for (const col of collections) {
    for (const field of fields) {
      const snap = await db.collection(col).where(field, "==", clickId).limit(1).get();
      if (!snap.empty) {
        const doc = snap.docs[0];
        return { id: doc.id, collection: col, data: doc.data() };
      }
    }
  }
  return null;
}

export default async function handler(req, res) {
  try {
    const q = req.method === "POST" ? { ...req.query, ...(req.body || {}) } : req.query;
    const click_id = String(q.click_id || q.clickId || q.trackingId || q.subid || q.sub_id || "").trim();
    const event = String(q.event || q.event_id || q.status || "conversion").trim();
    const payoutRaw = q.payout ?? q.amount ?? q.reward ?? 0;
    const payout = Number(String(payoutRaw).replace(/[^0-9.]/g, "")) || 0;

    if (!click_id) {
      return res.status(400).json({ success: false, error: "click_id missing" });
    }

    const existing = await db.collection("postback_logs")
      .where("click_id", "==", click_id)
      .where("event", "==", event)
      .limit(1)
      .get();

    if (!existing.empty) {
      return res.status(200).json({ success: true, status: "duplicate", click_id, event });
    }

    const found = await findClick(click_id);

    if (!found) {
      await db.collection("postback_logs").add({
        click_id,
        event,
        payout,
        status: "unmatched",
        raw: q,
        time: Date.now(),
      });
      return res.status(200).json({ success: true, status: "unmatched", click_id, event });
    }

    const click = found.data;
    const userId = click.userId || click.publisherId || click.affiliateId || click.uid || "";
    const campaignId = click.campaignId || click.offerId || "";
    const campaignTitle = click.campaignTitle || click.offerName || click.title || "";
    const upi = click.upi || click.p1 || "";

    const leadData = {
      clickId: click_id,
      trackingId: click_id,
      userId,
      publisherId: userId,
      campaignId,
      campaignTitle,
      offerName: campaignTitle,
      goalName: event || "conversion",
      event: event || "conversion",
      payout,
      reward: payout,
      status: "approved",
      source: "postback",
      upi,
      time: Date.now(),
      clickCollection: found.collection,
      raw: q,
    };

    await db.collection("lead_submissions").add(leadData);

    if (userId && payout > 0) {
      const userRef = db.collection("users").doc(userId);
      await db.runTransaction(async (tx) => {
        const userSnap = await tx.get(userRef);
        const oldBalance = Number(userSnap.data()?.balance || 0);
        tx.set(userRef, { balance: oldBalance + payout, updatedAt: Date.now() }, { merge: true });
      });
    }

    await db.collection("postback_logs").add({
      click_id,
      event,
      payout,
      userId,
      campaignId,
      campaignTitle,
      status: "approved",
      matchedCollection: found.collection,
      matchedDocId: found.id,
      time: Date.now(),
    });

    return res.status(200).json({
      success: true,
      status: "approved",
      click_id,
      event,
      userId,
      payout,
      matchedCollection: found.collection,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
