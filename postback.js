import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\n/g, "
"),
    }),
  });
}

const db = admin.firestore();
const now = () => Date.now();

function clean(v){ return String(v || "").trim(); }
function num(v){ const n = Number(v || 0); return Number.isFinite(n) ? n : 0; }

async function findClick(clickId){
  const collections = ["click_logs", "clicks"];
  const fields = ["trackingId", "clickId", "click_id", "subid"];
  for (const col of collections) {
    for (const field of fields) {
      const snap = await db.collection(col).where(field, "==", clickId).limit(1).get();
      if (!snap.empty) {
        const doc = snap.docs[0];
        return { id: doc.id, collection: col, ...doc.data() };
      }
    }
  }
  return null;
}

async function alreadyProcessed(clickId, event){
  const snap = await db.collection("lead_submissions")
    .where("clickId", "==", clickId)
    .where("goalName", "==", event)
    .where("source", "==", "postback")
    .limit(1).get();
  return !snap.empty;
}

export default async function handler(req, res) {
  try {
    const q = req.query || {};
    const click_id = clean(q.click_id || q.clickId || q.trackingId || q.subid || q.sub1);
    const event = clean(q.event || q.event_id || q.goal || q.status || "conversion");
    const pay = num(q.payout || q.reward || q.amount);

    if (!click_id) {
      return res.status(400).json({ success: false, error: "click_id missing" });
    }

    const click = await findClick(click_id);
    if (!click) {
      await db.collection("postback_logs").add({
        click_id, event, payout: pay, status: "unmatched", raw: q, time: now(), createdAt: now()
      });
      return res.status(200).json({ success: true, status: "unmatched" });
    }

    if (await alreadyProcessed(click_id, event)) {
      await db.collection("postback_logs").add({
        click_id, event, payout: pay, status: "duplicate", clickDocId: click.id, time: now(), createdAt: now()
      });
      return res.status(200).json({ success: true, status: "duplicate" });
    }

    const userId = click.userId || click.publisherId || click.affiliateId || click.uid || "";
    const campaignId = click.campaignId || "";
    const campaignTitle = click.campaignTitle || click.offerName || "";
    const workerName = click.workerName || click.name || click.worker || "";
    const upi = click.upi || click.workerUpi || click.p1 || "";

    await db.collection("lead_submissions").add({
      clickId: click_id,
      trackingId: click_id,
      click_id,
      subid: click_id,
      userId,
      publisherId: userId,
      campaignId,
      campaignTitle,
      goalName: event,
      event,
      payout: pay,
      reward: pay,
      status: "approved",
      source: "postback",
      workerName,
      workerUpi: upi,
      upi,
      time: now(),
      createdAt: now(),
    });

    if (userId && pay > 0) {
      const userRef = db.collection("users").doc(userId);
      await db.runTransaction(async (tx) => {
        const userSnap = await tx.get(userRef);
        const oldBalance = Number(userSnap.data()?.balance || 0);
        tx.set(userRef, { balance: oldBalance + pay, updatedAt: now() }, { merge: true });
      });
    }

    await db.collection("postback_logs").add({
      click_id, event, payout: pay, userId, campaignId, campaignTitle,
      workerName, upi, status: "approved", clickDocId: click.id, clickCollection: click.collection,
      time: now(), createdAt: now(), raw: q
    });

    return res.status(200).json({ success: true, status: "approved", userId, payout: pay });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
