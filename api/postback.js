import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  try {
    const { click_id, event, payout } = req.query;

    if (!click_id) {
      return res.status(400).json({ success: false, error: "click_id missing" });
    }

    const pay = Number(payout || 0);

    const clickSnap = await db
      .collection("click_logs")
      .where("trackingId", "==", click_id)
      .limit(1)
      .get();

    if (clickSnap.empty) {
      await db.collection("postback_logs").add({
        click_id,
        event: event || "",
        payout: pay,
        status: "unmatched",
        time: Date.now(),
      });

      return res.status(200).json({ success: true, status: "unmatched" });
    }

    const clickDoc = clickSnap.docs[0];
    const click = clickDoc.data();

    const userId = click.userId || click.publisherId || click.uid;
    const campaignId = click.campaignId || "";
    const campaignTitle = click.campaignTitle || click.offerName || "";

    await db.collection("lead_submissions").add({
      clickId: click_id,
      userId,
      campaignId,
      campaignTitle,
      goalName: event || "conversion",
      payout: pay,
      reward: pay,
      status: "approved",
      source: "postback",
      time: Date.now(),
    });

    if (userId && pay > 0) {
      const userRef = db.collection("users").doc(userId);
      await db.runTransaction(async (tx) => {
        const userSnap = await tx.get(userRef);
        const oldBalance = Number(userSnap.data()?.balance || 0);
        tx.set(userRef, { balance: oldBalance + pay }, { merge: true });
      });
    }

    await db.collection("postback_logs").add({
      click_id,
      event: event || "",
      payout: pay,
      userId: userId || "",
      campaignId,
      status: "approved",
      time: Date.now(),
    });

    return res.status(200).json({
      success: true,
      status: "approved",
      userId,
      payout: pay,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
}
