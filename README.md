# Clearbill

> Two AI agents settle a medical bill so the humans do not have to argue. PayPal collects the money.

Built for the **PayPal AI Hackathon (Build What's Next with PayPal and AI)**. One person, one codebase: a phone-first **patient app**, a **clinic website** with a billing desk and AG Studio dashboards, and a thin **Android app**.

- **Live demo:** https://clearbill-sm7c.onrender.com (patient app at `/`, clinic site at `/clinic`)
- **Demo video (under 3 minutes):** https://youtu.be/E48VVr5sKc0
- **License:** MIT

> **IMPORTANT: this is a hackathon prototype, not a real product.** There is no app in any app store and no real service for patients or clinics.
> - **All data is mock (fictional).** Every patient, clinic, bill, phone number and amount is made up. No real person's information and no protected health information (PHI) is collected, stored or used.
> - **All money is PayPal sandbox test money.** No real payment is ever made.
> - **Not HIPAA compliant, not a medical device, and not medical, legal or financial advice.** Do not use it with real patient data. See [COMPLIANCE.md](COMPLIANCE.md).
> - The Android file in this repository is a debug test build that opens the demo website. It is not published anywhere.

---

## The problem

In the US you get care first and the bill arrives weeks later. KFF's Health Care Debt Survey found that about **41% of US adults (around 100 million people) carry debt from medical or dental bills** ([KFF](https://www.kff.org/health-costs/issue-brief/kff-health-care-debt-survey/)). Bills are hard to read, mistakes are common, and many people either ignore the bill or pay a wrong amount without a plan.

The story we built the demo around: **Ethan Cole** has a cycling accident, emergency surgery, and then a **$43,110** bill after his insurer denies the claim. He cannot pay that. He also cannot tell what is a real charge and what is a mistake.

## What Clearbill does

1. **Understand.** The patient opens a bill, or photographs one. Each line is explained in plain words. Rules plus an AI second opinion flag likely mistakes (a charge billed twice, an extra hospital night, a wrongly denied emergency claim).
2. **Agree.** The patient sets a monthly budget. The **patient's agent** and the **clinic's agent** negotiate a plan inside the clinic's own rules. The numbers come from rules. The AI only writes what each agent says.
3. **Pay with PayPal.** The plan becomes a real **PayPal sandbox subscription** (monthly installments), and the bill can also be sent as a **PayPal invoice with a QR code**. The patient approves on PayPal's own page.
4. **The clinic sees it.** The clinic site shows the flagged bill, the agent conversation, the active plan, the money received, and dashboards of billing and collections.

For Ethan the agents settle on **$250 a month for 18 months** against a fair share of **$4,500**.

---

## Try it (judges)

No install needed. Use the live site.

**Patient app** (`/`, best on a phone or a narrow window)
1. Enter the demo phone number **123 456 789** (Ethan Cole).
2. Open the hospital bill, review the flags, set a budget (try 250), and send the offer to the clinic's agent.
3. Approve the plan. You go to PayPal's sandbox page.
4. Sign in with the sandbox patient account (below), click **Continue**, then **Agree and Subscribe**.
5. You return to Clearbill with "Your plan is active". Check the **Active EMIs** tab.

**PayPal sandbox patient (buyer) login:** `sb-472mr153814445@personal.example.com`. The password is in the testing notes of the Devpost submission. This is a fake sandbox account.

**Clinic site** (`/clinic/login`)
- Billing admin: phone **987 654 321**, code **246810**. Sees everything.
- Front desk: phone **987 654 322**, code **246810**. Sees patients and requests only, no amounts.

(The sign-in code is shown on screen because this is a demo. A real launch would send a text message.)

Clinic tabs: **Overview**, **Dashboard** (AG Studio), **Patients**, **Pending requests**, **Audit log**, plus the **Billing desk** (PayPal money, EMI plans, invoices) and **Billing analytics** (AG Studio over the PayPal data).

**Other demo patients** (each sees only their own bill): Maria Lopez 555 010 0101, James Okafor 555 010 0102, Priya Raman 555 010 0103, Daniel Brooks 555 010 0104, Aisha Khan 555 010 0105, Elena Petrova 555 010 0106. Any number the clinic has not registered shows how a new patient is guided to ask the clinic to register.

**Sample data:** to avoid empty screens, the clinic side is pre-filled with fictional patients, registration requests, flagged bills with agent conversations, EMI plans and six months of invoice history. Sample rows are marked (plan IDs start with `SAMPLE-`, invoice IDs with `SAMPLE-INV-`) and are not counted in the live money totals. Real PayPal sandbox invoices and plans you create appear alongside them.

---

## How we use PayPal

PayPal is the center of the product, not an add-on. Everything below runs against the **PayPal sandbox** with a US sandbox business account (the clinic) and a US sandbox personal account (the patient).

| PayPal API | Endpoint | What it does in Clearbill |
|---|---|---|
| OAuth 2.0 | `POST /v1/oauth2/token` | Server-side access token (client id and secret never reach the browser) |
| **Subscriptions** | `POST /v1/catalogs/products`, `POST /v1/billing/plans`, `POST /v1/billing/subscriptions`, `GET /v1/billing/subscriptions/{id}` | The agreed plan becomes a real monthly installment plan. The last payment is the exact remainder so the total matches the balance. The patient approves on PayPal, and the app reads the live status (Active, next payment date, last payment) |
| **Invoicing v2** | `GET .../generate-next-invoice-number`, `POST /v2/invoicing/invoices`, `POST .../send`, `POST .../generate-qr-code` | The corrected bill becomes a sent PayPal invoice with a QR code the patient can pay |
| Reporting | `GET /v1/reporting/balances`, `GET /v1/reporting/transactions` | The clinic's **Billing desk** and analytics show money received, fees and balance (needs "Transaction search" switched on for the sandbox app) |
| Invoicing and catalog reads | `GET /v2/invoicing/invoices`, `GET /v1/catalogs/products`, `GET /v1/billing/plans` | Feed the Billing desk table and the AG Studio billing analytics |

The clinic's side is a **billing desk** built on the clinic's PayPal business account: EMI plans with live PayPal status, invoices, money received, and fees.

### PayPal rules we checked

- **Sandbox only.** No live money, no real card or bank data. Test accounts are US region, because an India-region sandbox account cannot send USD invoices.
- **Acceptable Use Policy.** PayPal lists "Medical Items or Services" as an activity that needs **pre-approval**, and restricts payment facilitators and escrow-style services. So in a real launch **each clinic connects its own approved PayPal merchant account** and Clearbill never holds or pools funds. In the demo, the sandbox business account plays the clinic. Details in [COMPLIANCE.md](COMPLIANCE.md).
- **Hackathon rules.** PayPal integration is central to the project (checked against the Official Rules). The project is original work, uses third-party SDKs and APIs only under their own licenses (listed below), has an open-source license (MIT), a hosted demo, test logins, and a video under three minutes with no third-party music.

---

## How we use AI

**Model:** Google Gemini `gemini-3.5-flash-lite` through the Gemini API (free AI Studio tier), called from the server (`web/src/lib/llm.ts`). The sponsors do not supply a model, so this is our own choice.

| Where | What the AI does | What does not use AI |
|---|---|---|
| Bill review | Writes a plain-language summary of each line, questions to ask the clinic, and up to two extra flags the rules might miss | The core mistake detection and the fair-share estimate are **rules** (`audit.ts`) |
| Agents | Writes what the patient's agent and the clinic's agent say | The plan numbers (monthly amount, months, minimums, maximums, preferred length) come from **rules** (`negotiate.ts`) and the clinic's stated policy |
| Bill photo scan | Reads a photo of a paper bill with Gemini vision (`/api/scan`) and turns it into a structured bill. The server re-validates it and runs the same rules | The photo is not stored |
| "Ask your data" box | Turns a plain-English question into a filter over the payment plans (for example "Show late plans over $500") | The filtering itself is plain code over the data, and a keyword fallback works with no AI key |

**The AI never decides money.** Rules decide the numbers, the AI explains and writes. If there is no AI key, the app still works with rule-based text.

We did **not** use the Studio Agent Framework or a PayPal MCP server. We say so plainly so judges do not look for them.

---

## How we use the sponsor tools

### AG Grid and AG Studio (Best Use of AG Grid)

There is no separate submission for the AG Grid prize. Sponsor prizes are open to every eligible submission that uses the sponsor's tools, so this section is where we show it.

**AG Studio** (`ag-studio` and `ag-studio-react` 3.0, from the sponsor's boilerplate) draws **every chart** in the clinic site:
- **Dashboard tab** (`/clinic`, Dashboard): one AG Studio report with three pages, **Money** (billed, collected, outstanding, corrected, aging, billed vs collected, plan balances, plans grid), **Patients and requests** (visit types, registrations by month and staff, request status, patients grid) and **Care and activity** (flagged bills, savings, staff actions by type and person, flagged bills grid). Built in `web/src/app/clinic/dashboard-tab.tsx`.
- **Overview tab:** the "unpaid balances by days past due" bar chart and the "billed vs collected" line chart (`clinic-studio.tsx`).
- **Billing analytics** (`/clinic/billing/studio`): the full report over the PayPal sandbox data (invoices, payments, plans, ledger), with date filter, cross-filtering, KPI tiles with sparklines, a collection-rate gauge, a combo column and line chart, a sunburst, a bar chart, a donut and a pivot grid. Data model, relations, calendar and measures are in `web/src/app/clinic/billing/studio/`.
- **Polish we added:** a custom theme tied to the app's design tokens (`studio/theme.ts` and the `--pp-*` variables in `globals.css`), a layout we tuned per page, hidden panels for a clean view mode, a page switcher, clearer chart types (we replaced a treemap and a radial chart that were hard to read), and sample history so the charts have something to show. Patients are shown by shortened name only and no phone numbers are passed to Studio.

**AG Grid Community** (`ag-grid-community` and `ag-grid-react` 36) draws every table: the payment plans, patients, registration requests, audit log, ask-box results, and the Billing desk's EMI plans, invoices and transactions. The patients table masks names and numbers by default.

The AG Studio trial watermark may show, because we use the free trial without a license key. Set `AG_STUDIO` to a trial key to remove it.

### Render

The app is hosted on **Render** as one Node web service (`render.yaml`, root directory `web`, Node 22). Secrets are typed into Render's dashboard and are never in the repo. Live: https://clearbill-sm7c.onrender.com.

### Other tools

| Tool | Use |
|---|---|
| Next.js 16, React 19, TypeScript | The whole app, server routes included |
| Capacitor 7 | Android wrapper that opens the live site full screen (`patient-android-app/`). A debug APK is for testing only |
| Google Gemini API | See "How we use AI" |
| Claude Code | Used to build this project |

---

## What we built during the hackathon

The project was planned on Oct 27, 2026 and the first commit is Nov 9, 2026, both inside the submission period (Oct 1 to Nov 12). Everything here was built for this hackathon:

- Patient app: phone sign-in, bill review, add a bill by camera, gallery, typing or sample photo, budget, agent negotiation, PayPal approval, tabs for Bills, Active EMIs and This cycle.
- Clinic site: staff sign-in with roles, patient registration, registration requests, patient search, audit log, the "ask your data" box.
- PayPal: invoices with QR, installment plans, live status, billing desk.
- AG Studio dashboards and AG Grid tables (above).
- Android wrapper, Render deploy, compliance notes.

## Privacy and security safeguards (prototype level)

Summarized from [COMPLIANCE.md](COMPLIANCE.md): staff sign-in with a one-time code, two roles (billing admin sees money, front desk does not), 20-minute sessions with 10-minute idle sign-out, lockout after five wrong codes, masked names and numbers with an audited "show details", an audit log that stores no patient data, patient registration only by request and staff approval, and patients can open only their own bills. **These show the shape of a real system. They do not make the prototype HIPAA compliant.** It is not a medical device, so FDA clearance does not apply.

## Where things are

| What | Where |
|---|---|
| **Patient app** (phone-first: bills, AI review, agents, PayPal approval, Active EMIs) | `web/src/app/page.tsx` |
| **Clinic website** (sign-in, patients, requests, audit log) | `web/src/app/clinic/` |
| **AG Studio dashboards** (clinic Dashboard tab, billing analytics) | `web/src/app/clinic/dashboard-tab.tsx`, `clinic-studio.tsx`, `web/src/app/clinic/billing/studio/` |
| **Billing desk** (PayPal plans, invoices, money received) | `web/src/app/clinic/billing/` |
| **PayPal code** (Subscriptions, Invoicing, Reporting) | `web/src/lib/paypal.ts`, `web/src/lib/paypal-reports.ts` |
| **Rules** (mistake detection, plan negotiation limits) | `web/src/lib/audit.ts`, `web/src/lib/negotiate.ts` |
| **AI** (Gemini: bill review, agents, scan, ask box) | `web/src/lib/llm.ts`, `web/src/lib/ai.ts`, `web/src/lib/explain.ts` |
| **API routes** (login, negotiate, PayPal, scan, staff) | `web/src/app/api/` |
| **Mock bills** (fictional, with planted errors) | `data/fake-bills/` |
| **Android test app** (opens the patient app on a phone) | `patient-android-app/` |
| **Deploy settings** (Render) | `render.yaml` |
| **Privacy notes and limits** | `COMPLIANCE.md` |

The patient app and the clinic website live in one Next.js app (`web/`) because they share the same bills, plans, rules and PayPal code.

## Run it yourself

Requirements: Node 20 or newer.

```bash
cd web
npm install
cp ../.env.example ../.env     # then fill in the values below
ln -s ../.env .env.local        # lets Next.js read the shared .env
npm run dev                     # http://localhost:3000
```

Values for `.env`:
- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`: a PayPal **sandbox** app (developer.paypal.com, Apps and Credentials). Turn on Subscriptions and Invoicing. Turn on Transaction search to fill the balance and payments tiles.
- `PAYPAL_ENV=sandbox`
- `PAYPAL_SANDBOX_BUSINESS_EMAIL`, `PAYPAL_SANDBOX_PERSONAL_EMAIL`: two US-region sandbox accounts.
- `GEMINI_API_KEY` (optional): free key from aistudio.google.com. Without it the app uses rule-based text.
- `SESSION_SECRET`: any long random string (signs the staff cookie).
- `APP_URL`: `http://localhost:3000` locally, the public address when deployed (PayPal returns patients here).
- `AG_STUDIO` (optional): AG Studio trial license key.

Production build: `npm run build && npm start`.

**Deploy on Render:** connect the repo, set root directory `web`, build `npm install && npm run build`, start `npm start`, and add the variables above.

**Android:** `patient-android-app/` is a Capacitor project. Set the site address in `capacitor.config.json`, run `npx cap sync android`, then build with Gradle (`./gradlew assembleDebug`).

## Honest limits

- PayPal sandbox cannot reproduce real clinic payments or disputes.
- Testing is very limited (see the Testing section below).
- Billing-error detection is a heuristic and can be wrong. The agent shows its reasoning and asks a person to confirm.
- Server data (patients, requests, audit log) is held in memory in this prototype, so it resets when the service restarts. A real launch would use an encrypted database.
- The Android app is a debug build for testing, not a store release.

## Testing (very limited, please read)

Testing for this prototype is **very limited**. It was built by one person in a short time, and it has not been through proper QA.

- **No automated test suite.** The only test file in the repository is the default example that the Android template generated.
- **What was checked:** the TypeScript type check and the production build pass. The main flows were tried by hand: patient sign-in, bill review, the two agents, the PayPal invoice and subscription with a sandbox buyer approving the plan, staff sign-in for both roles, patient registration and requests, the audit log, the "ask your data" box, and the AG Studio dashboards. The live site on Render was also tried by hand.
- **Devices:** tried on desktop Chrome and one Samsung Android phone only. Not tested on iPhone or iOS Safari, Firefox, screen readers, or under heavy use.
- **Rules and AI:** the mistake-detection rules were only run on the nine mock bills in `data/fake-bills/`. AI wording can vary between runs and has not been evaluated in any systematic way.
- **PayPal:** tested only in the sandbox with one business and one buyer test account. Webhooks are not implemented (the app reads the plan status when asked), and later monthly charges were not observed.
- **Expect rough edges.** If something looks broken, it may be a bug, not a design choice.

## License

MIT. See [LICENSE](LICENSE).
