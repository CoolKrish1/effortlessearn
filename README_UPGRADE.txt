Campaign Reward Hub - V21 PathakCPA Redirect Fix

Important setup:
1. In Admin > Add Campaign, paste the exact PathakCPA Smart Tracking Link in Destination URL field.
   Example: https://panel.pathakcpa.in/click/z3sqkb?pub=xxxx
2. Do not add extra click_id/pub manually unless PathakCPA gives a specific sub parameter.
3. campaign.html now redirects to the exact saved URL and will not append extra parameters automatically.
4. If a network asks for subid, use placeholder in URL: &sub1={click_id}
5. Publish firestore.rules in Firebase Console > Firestore Database > Rules.
