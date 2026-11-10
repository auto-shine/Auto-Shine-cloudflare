# AutoShine: Cloudflare booking setup

The site now runs on Cloudflare Pages, not Netlify. The Netlify instructions below
are historical and must not be used for the current site.

## Booking notifications

Each booking request is stored in D1, added to the Apple `Work` calendar and emailed
to the owner. It remains a request: Jake contacts the customer to confirm it. No
admin approval or automatic customer confirmation email is needed.

Availability reserves one hour either side of calendar events. It rechecks the
calendar before storing a request; if the calendar cannot be read, customers are
asked to try again or contact Jake. This recheck is not an atomic lock, so two
simultaneous requests may still need manual resolution. Check the calendar before
confirming bookings.

The contact form sends enquiries to the owner via Resend, with the customer's email
as the reply-to address. Photos are sent separately by email or WhatsApp. If sending
fails, the form asks the customer to contact Jake directly; enquiries are not stored.

In the Cloudflare Pages project, configure the following for the production
environment (and separately for preview if needed):

- `DB`: the D1 database binding in `wrangler.toml`, with the bookings table from
  `schema.sql`.
- `APPLE_CALDAV_URL`, `APPLE_USERNAME` and `APPLE_CALENDAR_NAME`: the Apple calendar
  server, Apple ID and calendar name. The non-secret defaults are in `wrangler.toml`.
- `APPLE_APP_SPECIFIC_PASSWORD`: the Apple app-specific password, stored as a secret.
- `RESEND_API_KEY`: a Resend API key, stored as a secret.
- `EMAIL_FROM` and `EMAIL_TO`: the verified Resend sender and the inbox receiving
  bookings and enquiries, respectively. Their non-secret defaults are in `wrangler.toml`.
  The sender domain is `notifications.auto-shine.co.uk`; the receiving inbox remains
  `jake@auto-shine.co.uk`. Verify the sender domain in Resend and make sure the key has
  sending access. Configure the preview secret separately before testing the form there.

### Ntfy me phone alerts

The Ntfy me app from ntfyme.net is a different service from ntfy.sh. Set its
token as a Cloudflare Pages production secret named `NTFYME_TOKEN`, then deploy.
Never commit or share the token. The booking function sends a generic message,
without customer details, to Ntfy me's `https://ntfyme.net/msg` API. Enable
notifications in the app and on the phone, then make a test booking and check both
the phone alert and Work calendar. If the app uses message filters, ensure they
allow the booking messages. A successful API response is not proof of phone delivery.
Check the app's current free-tier limits before relying on the service.

If publishing to Ntfy me fails, the function attempts the ntfy.sh topic below when
configured. A successful Ntfy me publish suppresses the ntfy.sh alert to avoid
duplicate notifications. The function logs publish failures without logging tokens.

### Free ntfy.sh phone alerts

The Cloudflare booking endpoint can also send a generic push alert through ntfy.
This is independent of email. To enable it:

1. In the ntfy app, subscribe to a new, long random topic on `https://ntfy.sh`.
   Use only letters, numbers, `_` and `-`, with no spaces or URL. Enable app and
   topic notifications in your phone settings.
2. In Cloudflare Pages, add `NTFY_TOPIC` as a production secret containing exactly
   the same topic name, and redeploy. Configure preview separately if testing there.
   Do not commit the topic or share it publicly.
3. Send a test message to the topic using the ntfy app or ntfy website. Confirm
   that your phone receives it, then make a test booking after deploying the site.
   Check for the push alert and the event in the Work calendar; delete the test event.

Anyone who knows an ntfy.sh topic can read or publish messages to it. Booking alerts
therefore contain no customer details: open the calendar for those. If the calendar
write fails, the alert says so and the customer is asked to contact Jake. Delivery
by ntfy to a phone is not guaranteed by a successful publish; check phone notification
permissions, battery restrictions, subscription server and the topic if alerts do not
arrive. Cloudflare function logs show missing/invalid topic and publish failures.

Never commit passwords or API keys. After updating environment settings, deploy the
site and make a real test request. Check that the owner email arrives, the event
appears at the correct local time in the Work calendar, and Jake can contact the
customer. Remove the test event afterwards.

If the calendar fails or both email and push fail, the request remains saved and the
customer is asked to contact Jake on WhatsApp instead of submitting it again. A calendar failure is
also mentioned in the owner email if email succeeds. Check Cloudflare Pages function
logs for `Calendar write failed` or `Booking email failed` and the booking ID.
If a calendar write failed, check the calendar before adding the event manually:
a network error can occur after Apple has accepted it.

## Historical Netlify instructions (not for the current site)

## What's in this folder
- `public/`            → YOUR WEBSITE (all your pages, css, js, images). Unchanged except two things:
                         a new "Book Online" link in the menu of every page, and the new page `public/book.html` (shows at /book).
                         `public/sitemap.xml` also lists /book.
- `netlify/functions/` → the booking brain (price, availability, book)
- `lib/`               → the logic. **`lib/config.js` holds every price, zone, job length and opening hour.**
- `netlify.toml`       → Netlify settings. Your headers and redirects are kept exactly as they were.
- `package.json`       → needs one library (tsdav) to talk to iCloud
- `test/`              → automated tests (`npm test`)

## A. One-off setup on Apple (5 minutes)
1. appleid.apple.com → Sign-In and Security → App-Specific Passwords → "+" → name it `AutoShine booking`. Copy the password.
2. In Apple Calendar create an iCloud calendar named exactly `Work`.
   Bookings are written there, and anything in it blocks those times (add "Day off" all-day events to block days).

## B. Add your calendar details to Netlify
Netlify → your site → Site configuration → Environment variables → Add a variable:
| Key                    | Value                                  |
|------------------------|----------------------------------------|
| ICLOUD_USERNAME        | your Apple ID email                    |
| ICLOUD_APP_PASSWORD    | the app-specific password from step A1 |
| ICLOUD_CALENDAR_NAME   | Work                                   |
| ICLOUD_BUSY_CALENDARS  | (optional) Work,Home  ← calendars that should block availability |
| RESEND_API_KEY         | your Resend key for instant booking emails, see "Alerts you get" below |
| ALERT_EMAIL_TO         | the email address that should receive booking alerts |
| NTFY_TOPIC             | (optional, not needed if you use email) phone-push topic name |
Never put these in any file.

## C. Deploy (on your computer)
1. Install Node.js (the LTS version) from nodejs.org.
2. Open Terminal (Mac) or Command Prompt (Windows) **inside this folder**, then run these one at a time:
       npm install
       npm install -g netlify-cli
       netlify login
       netlify link          (choose your existing AutoShine site)
3. Preview first (does not touch your live site):
       netlify deploy
   Open the "Website draft URL" it prints. Check your site looks normal and /book loads.
4. Go live:
       netlify deploy --prod

## D. Test with a real booking
1. On your phone open www.auto-shine.co.uk/book
2. Kenilworth postcode → check the price. Try one ~15 miles away and one ~25 miles away → price should rise.
3. Make a test booking → it should appear in your Work calendar within seconds.
4. Reload /book → that time should now be gone.
5. Delete the test booking from your calendar.
If a booking fails: Netlify → Logs → Functions → `book` shows the reason. Send it to Claude.

## Alerts you get
- **In your calendar:** every booking has two alerts: 6pm the evening before, and 1 hour before the start. (Apple Calendar
  never pings you when something is added to your own calendar. People it is shared with are notified; you aren't.)

- **Instant EMAIL for every new booking (recommended):** the email has the customer's name, phone, address, car, price,
  date/time and notes, and you can hit Reply to answer the customer directly.
  1. Go to **resend.com** and sign up (free) with the email address where you want the alerts. Choose an inbox you
     check on your phone. Confirm the verification email they send you.
  2. In Resend: **API Keys -> Create API Key**. Name it `AutoShine`, permission "Sending access", then Create.
     Copy the key (starts with `re_`). Resend only shows it once.
  3. In the command window, inside this folder, run these two (use your own key and email, keep the quote marks):
         netlify env:set RESEND_API_KEY "re_xxxxxxxx"
         netlify env:set ALERT_EMAIL_TO "you@example.com"
     IMPORTANT: ALERT_EMAIL_TO must be the SAME address you signed up to Resend with. Resend's free test sender can only
     deliver to that one address. (To send to other addresses later you verify your own domain in Resend.)
  4. Test it without making a booking:  `netlify dev:exec node scripts/send-test-email.mjs`
     It prints SENT or tells you why not. Check your inbox AND junk folder. If it lands in junk, mark it "Not junk".
  5. `netlify deploy`, make a test booking on the draft link, check the email arrives, then `netlify deploy --prod`.
  The email is also logged in Netlify (Logs -> Functions -> `book`) if anything goes wrong: look for "Booking email not sent".

- **Phone push via ntfy (optional, not needed if you use email):** set `NTFY_TOPIC` to a long random topic name and
  subscribe to it in the ntfy app. Topics on ntfy.sh are public to anyone who knows the name, so these messages never include
  the customer's name, phone or street address. To switch it off: `netlify env:unset NTFY_TOPIC`.

## Things to know
- Your site was originally produced by a builder that ran `node build.mjs`. That script wasn't in the files supplied,
  so `netlify.toml` now just publishes the ready-made `public/` folder. **From now on THIS folder is your master copy.**
  If you ever publish again from the old builder it will overwrite the booking page, so don't.
- To change prices, zones, job lengths, opening hours or notice: edit `lib/config.js`, run `npm test`, then `netlify deploy --prod`.
- Customers don't get an automatic confirmation message (the booking appears in your calendar and on screen), and
  can't cancel online. Both can be added later.
- Change the evening-before alert time in `lib/ics.js` (`eveningBeforeHour`, default 18).
