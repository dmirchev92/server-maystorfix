# SnapFix — Beta Tester Bug Reports
**App:** SnapFix (Android)  
**Version:** 1.2.3  
**Period:** 12.11.2025 – 14.01.2026  
**Testers:** 5 beta testers  
**Status:** All reported issues fixed  

---

## Summary

| | Count |
|---|---|
| Total reports | 9 |
| Fixed | 9 |
| Open | 0 |

---

## #1 — Wrong email shown on Privacy screen
**From:** damien.caumon@gmail.com  
**Date:** 12.11.2025  
**Device:** Samsung Galaxy A54, Android 14  

> Hi, I went to Settings → Privacy and at the bottom there's an email for contact but it says admin@maystorplus.com. I tried to send email there but it bounced back. What's the actual email?

**Fix:** Updated the contact email to admin@snapfix.bg on all privacy-related screens.

---

## #2 — Privacy page mentions AI features that don't exist
**From:** rosen.asparuhov@gmail.com  
**Date:** 18.11.2025  
**Device:** Xiaomi Redmi Note 12, Android 13  

> In Settings → Privacy there's a section about "AI Комуникация" or something like that. I don't see any AI in the app? Is that a leftover from something else? Also the list of companies you share data with looks wrong, it mentions services I don't think you actually use.

**Fix:** Removed the AI section, updated the text to correctly describe SMS and chat features, fixed the third-party services list.

---

## #3 — "Request My Data" button does nothing
**From:** J.konstantinov@gmail.com  
**Date:** 22.11.2025  
**Device:** Google Pixel 7, Android 14  

> I went to Settings → Data Rights and tapped "Request My Data" — nothing happens. No loading, no error, nothing. Same with the delete account button. Is this screen just for show?

**Fix:** Connected the Data Rights screen to the server. All buttons now work — data access, deletion request, etc.

---

## #4 — Wrong link for the data protection commission (КЗЛД)
**From:** doychinovadora@gmail.com  
**Date:** 29.11.2025  
**Device:** Samsung Galaxy S23, Android 14  

> The link in the privacy section that says it goes to КЗЛД — I tapped it and it goes to a wrong page. The correct site is cpdp.bg, just so you know.

**Fix:** Updated the КЗЛД link to https://cpdp.bg/ in the app.

---

## #5 — Profile avatar doesn't show on the chat screen
**From:** pavlinka.nikolova.georgieva@gmail.com  
**Date:** 04.12.2025  
**Device:** Huawei P30 Lite, Android 12  

> When I open a chat with a client, my profile picture doesn't show next to my messages. I can see it in my profile page but in the chat it's just a grey circle. The client's avatar shows fine though.

**Fix:** Fixed avatar loading in chat — profile image now displays correctly for both sender and receiver.

---

## #6 — Can't upload more than 5 gallery photos
**From:** rosen.asparuhov@gmail.com  
**Date:** 10.12.2025  
**Device:** Xiaomi Redmi Note 12, Android 13  

> I'm trying to add photos to my gallery but after 5 it says I've reached my limit. But my friend on the same plan has more. Is this a bug or am I on the wrong plan? I registered as free tier.

**Fix:** Adjusted the gallery photo limit for free tier accounts. Limit is now 20 photos as intended.

---

## #7 — Consent descriptions too vague
**From:** pavlinka.nikolova.georgieva@gmail.com  
**Date:** 17.12.2025  
**Device:** Huawei P30 Lite, Android 12  

> In Settings → Consents, the toggles just say like "analytics" and "marketing" but don't explain what they actually do. I don't know what I'm agreeing to. Can you add some explanation?

**Fix:** Added detailed descriptions for each consent toggle explaining exactly what data is collected and how it's used.

---

## #8 — Typo in consent screen footer
**From:** doychinovadora@gmail.com  
**Date:** 06.01.2026  
**Device:** Samsung Galaxy S23, Android 14  

> Small thing — on the consent page at the bottom, the email says dpo@snapfix.bg in one place and admin@snapfix.bg in another. Which one is correct?

**Fix:** Fixed to show admin@snapfix.bg consistently everywhere.

---

## #9 — Chat messages sometimes appear at wrong position
**From:** J.konstantinov@gmail.com  
**Date:** 10.01.2026  
**Device:** Google Pixel 7, Android 14  

> When I send a message in chat and then scroll up to read old messages, after new message arrives the chat jumps back to the bottom. Also sometimes my message shows up below the other person's reply, looks like the order is off for a second before it corrects itself.

**Fix:** Improved chat scroll behavior — new messages no longer interrupt scrolling, and message ordering is now consistent.

---

*Report prepared: 15.01.2026*
