const admin = require('firebase-admin');
const { onRequest } = require('firebase-functions/v2/https');

admin.initializeApp();
const db = admin.firestore();

function num(v){ const n = Number(v || 0); return Number.isFinite(n) ? n : 0; }

exports.postback = onRequest({ cors: true }, async (req, res) => {
  try {
    const q = { ...req.query, ...(req.body || {}) };
    const clickId = String(q.click_id || q.clickId || q.sub1 || '').trim();
    const event = String(q.event || q.event_id || q.status || 'approved').trim();
    const networkPayout = num(q.payout || q.amount);
    if (!clickId) return res.status(400).send('missing click_id');

    const existing = await db.collection('lead_submissions').where('clickId','==',clickId).limit(20).get();
    let leadRef = null;
    let lead = null;
    if (!existing.empty) {
      leadRef = existing.docs[0].ref;
      lead = { id: existing.docs[0].id, ...existing.docs[0].data() };
    } else {
      const clickSnap = await db.collection('click_logs').where('clickId','==',clickId).limit(1).get();
      const click = clickSnap.empty ? {} : clickSnap.docs[0].data();
      leadRef = db.collection('lead_submissions').doc();
      lead = {
        clickId,
        campaignId: click.campaignId || '',
        campaignTitle: click.campaignTitle || '',
        publisherId: click.publisherId || '',
        userId: click.publisherId || '',
        smartId: click.smartId || '',
        slug: click.slug || '',
        upi: click.upi || '',
        reward: 0,
        affiliateProfit: networkPayout,
        source: 'postback'
      };
      await leadRef.set({ ...lead, status:'pending', time:Date.now(), createdAt:Date.now() }, { merge:true });
    }

    const wasApproved = String(lead.status || '').toLowerCase() === 'approved';
    const affiliateProfit = num(lead.affiliateProfit || lead.profit || networkPayout);
    const publisherId = lead.publisherId || lead.affiliateId || lead.userId || '';

    await leadRef.set({
      status: 'approved',
      event,
      networkPayout,
      approvedAt: Date.now(),
      updatedAt: Date.now(),
      postback: q
    }, { merge: true });

    if (!wasApproved && publisherId && affiliateProfit > 0) {
      const userRef = db.collection('users').doc(publisherId);
      await db.runTransaction(async (tx) => {
        const u = await tx.get(userRef);
        const oldBal = num(u.exists ? u.data().balance : 0);
        tx.set(userRef, { balance: oldBal + affiliateProfit, updatedAt: Date.now() }, { merge:true });
      });
    }

    await db.collection('postback_hits').add({ clickId, event, payout: networkPayout, publisherId, receivedAt: Date.now(), query: q, status:'ok' });
    return res.status(200).send('OK');
  } catch (e) {
    console.error(e);
    await db.collection('postback_hits').add({ error: e.message, receivedAt: Date.now(), query: req.query || {}, status:'error' }).catch(()=>{});
    return res.status(500).send('ERROR: ' + e.message);
  }
});
