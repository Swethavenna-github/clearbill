# Devpost submission text for Clearbill (copy and paste)

## Project name
Clearbill

## Tagline
Two AI agents agree a payment plan for a medical bill. PayPal collects it.

---

## IMPORTANT NOTICE (paste this first in the description)

**Clearbill is a hackathon prototype, not a real product.** There is no app in any app store and no real service running for patients or clinics.

- **All data is mock (fictional).** Every patient, clinic, bill, phone number, diagnosis and amount in the demo is made up. No real person's information, and no protected health information (PHI), is collected, stored or used.
- **All money is PayPal sandbox test money.** No real payment is ever made.
- **Not HIPAA compliant and not a medical device.** The prototype is built only to show an idea. It uses an in-memory store, a demo sign-in code and no business agreements with any vendor, so it must not be used with real patient data. The privacy features shown (roles, masked data, audit log) show the shape of a real system and do not make this prototype compliant. A real launch would need HIPAA agreements, encryption at rest, real sign-in and PayPal merchant approval. See COMPLIANCE.md in the repository.
- **Not medical, legal or financial advice.** Mistake detection is a heuristic and can be wrong.
- The Android file in the repository is a debug test build that opens the demo website. It is not published anywhere.

---

## Inspiration
In the US you get care first and the bill arrives weeks later. According to KFF's Health Care Debt Survey, about **41% of US adults (around 100 million people) carry debt from medical or dental bills** ([KFF](https://www.kff.org/health-costs/issue-brief/kff-health-care-debt-survey/)). Bills are hard to read, mistakes are common, and many people cannot pay a large bill in one go. Clinics chase unpaid balances and often fail, because there is no easy way to agree a plan that works for both sides.

Our story: **Ethan Cole** is hit by a car on a Saturday bike ride, spends days in hospital, and then receives a **$43,110** bill that his insurer denied. He did nothing wrong, and he cannot pay it.

## What it does
Clearbill has a phone-first **patient app** and a **clinic website**.

1. **Understand.** The patient opens a bill, or photographs one. Each line is explained in plain words. Rules plus an AI second opinion flag likely mistakes (a charge billed twice, an extra hospital night, an out-of-network charge, a wrongly denied emergency claim).
2. **Agree.** The patient sets a monthly budget. The patient's agent and the clinic's agent negotiate a plan inside the clinic's own rules. The numbers come from rules. The AI only writes what each agent says. For Ethan the agents settle on $250 a month for 18 months.
3. **Pay with PayPal.** The plan becomes a real monthly **PayPal sandbox subscription**, and the bill can be sent as a **PayPal invoice with a QR code**. PayPal is the bridge between patient and clinic: it sets up the plan and collects every payment.
4. **The clinic sees it live.** Clinics register their patients, and bills come straight from the clinic. The clinic site has staff sign-in with roles, patient registration and requests, a data search box, an audit log, and a billing desk showing PayPal plans, invoices and money received.
5. **AG Studio dashboards.** Every chart on the clinic site is drawn with AG Studio: a three-page dashboard (Money, Patients and requests, Care and activity) and a billing analytics report over the PayPal data.

## How we built it
- **PayPal (central):** OAuth, Subscriptions (product, plan, subscription, live status), Invoicing v2 (create, send, QR code), and Reporting (balances, transactions) in the PayPal sandbox with US business and personal test accounts.
- **AI:** Google Gemini (`gemini-3.5-flash-lite`) for the plain-language bill review, the two agents' wording, the bill photo scan, and the "ask your data" box. Rules decide the money, the AI explains. The app still works without an AI key.
- **AG Grid and AG Studio:** AG Grid Community draws every table. AG Studio draws every chart (themed to the app's design tokens, per-page layouts, KPI tiles, gauge, sunburst, combo chart, pivot).
- **Render:** the whole app runs as one Node web service on Render.
- **Stack:** Next.js 16, React 19, TypeScript, and a Capacitor Android wrapper for testing.
- **Video:** short film shots made with Seedance 2.0 and images made with ChatGPT. The on-screen presenter and voice-over were generated with Seedance.

## What we built during the hackathon
The project was planned on Oct 27, 2026, and the first commit is Nov 9, 2026. Everything was built during the submission period: the patient app, the clinic site, the PayPal integration, the AI agents, the AG Studio dashboards, the staff roles and audit log, the Android wrapper and the Render deployment.

## Challenges
- Making sure the AI never decides money: mistake detection and plan numbers are rules, and the AI only explains and writes.
- PayPal sandbox accounts must be US region, or USD invoices fail.
- Making a believable dashboard with no real data, so we added clearly labelled sample history.

## What's next
A real launch would need: HIPAA business agreements with every clinic and vendor, encryption at rest and a real database, real text-message sign-in, each clinic connecting its own approved PayPal merchant account (PayPal lists medical services as needing pre-approval, and Clearbill would never hold funds), and review of billing-error detection by billing professionals.

## Built with
PayPal (Subscriptions, Invoicing, Reporting, sandbox), Google Gemini, AG Studio, AG Grid, Render, Next.js, React, TypeScript, Capacitor, Seedance, ChatGPT, GitHub

## Try it out (links)
- Live demo: https://clearbill-sm7c.onrender.com
- Source code: https://github.com/Swethavenna-github/clearbill (MIT license)
- Video: https://youtu.be/E48VVr5sKc0

## Testing instructions (judges)
Everything below is fictional demo data.

**Patient app** (open the live demo, best on a phone or a narrow window)
1. Enter the demo number **123 456 789** (Ethan Cole).
2. Open the $43,110 bill, review the flagged mistakes, set the budget to 250, send it to the clinic's agent, and approve.
3. On PayPal's sandbox page, sign in with the sandbox buyer `sb-472mr153814445@personal.example.com` and the password **(enter your sandbox password here)**, click Continue, then Agree and Subscribe.
4. You return to Clearbill with "Your plan is active". Open the **Active EMIs** tab.

**Clinic website** (`/clinic/login`)
- Billing admin: phone **987 654 321**, code **246810**. Sees everything.
- Front desk: phone **987 654 322**, code **246810**. Sees patients and requests, no amounts.
- (The sign-in code is shown on screen because this is a demo.)

Other demo patients (each sees only their own bill): Maria Lopez 555 010 0101, James Okafor 555 010 0102, Priya Raman 555 010 0103, Daniel Brooks 555 010 0104, Aisha Khan 555 010 0105, Elena Petrova 555 010 0106.

The clinic site is pre-filled with clearly marked sample data (sample plan IDs start with `SAMPLE-`). Real PayPal sandbox invoices and plans you create show alongside it.
