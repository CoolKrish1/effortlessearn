V22 All-in-one Stable Upgrade

Added:
1. Postback Cloud Function: functions/index.js
   - Endpoint after deploy: https://YOUR_HOST/postback-api?click_id={click_id}&event={event_id}&payout={payout}
   - It auto approves lead_submissions by click_id.
   - It credits publisher wallet with affiliateProfit.
   - It stores every hit in postback_hits.

2. Postback page improved:
   - Login -> Postback page -> copy recommended URL.
   - Paste URL in PathakCPA Global Postback.

3. Reports export CSV.
4. Admin export CSV for users/leads/withdrawals.
5. Admin analytics cards.
6. Mobile UI and compact polish.
7. Safer Firestore rules included.

Important:
- For real server-to-server postback, deploy Firebase Functions.
- If you only upload to GitHub/Hosting, PathakCPA cannot run browser JavaScript.
- Firestore rules must still be pasted/published in Firebase Console, or deployed using Firebase CLI.

Deploy commands if using Firebase CLI:
1. firebase deploy --only firestore:rules
2. cd functions && npm install && cd ..
3. firebase deploy --only functions,hosting

PathakCPA Postback format:
https://YOUR_DOMAIN/postback-api?click_id={click_id}&event={event_id}&payout={payout}
