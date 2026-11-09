# Clearbill (working title)

> Two AI agents settle a medical bill so the humans do not have to argue.

In the US you get care first and the bill arrives weeks later. Clearbill is a working prototype that helps with that moment:

1. **Understand.** A patient opens a bill. Each line is explained in plain words. Rules plus an AI second opinion flag likely mistakes (a charge billed twice, an extra hospital night, a wrongly denied emergency claim).
2. **Agree.** The patient sets a monthly budget. The patient's agent and the clinic's agent negotiate a plan. The numbers follow the clinic's rules; the AI writes what each agent says.
3. **Pay with PayPal.** A PayPal invoice (with QR code) and a monthly installment plan are created in the PayPal sandbox. The clinic dashboard shows the plan, with an "ask your data" box that answers questions in plain English.

**Demo with fictional data only.** Read [COMPLIANCE.md](COMPLIANCE.md). Money is PayPal sandbox test money.

## What is in the repo
- `web/`: the app (Next.js). Patient screens at `/`, clinic dashboard at `/clinic`.
- `data/fake-bills/`: 8 synthetic bills with planted errors and an answer key. The hero bill is **B09 (Ethan, $43,110)**.
- `render.yaml`: one-click deploy on Render.
- `COMPLIANCE.md`: what this prototype is not, and what a real launch would need.

## Tools used
| Tool | How it is used |
|---|---|
| **PayPal sandbox** (REST) | Invoicing API (create, send, QR code), Subscriptions API (installment plan and approval), subscription status check |
| **Google Gemini** (`gemini-3.5-flash-lite`, free tier via AI Studio) | Plain-language bill summary and questions to ask, up to two extra flags, the two agents' wording, and the dashboard "ask" box (question to table filter) |
| **AG Grid Community** | Plans table and ask-box results on the clinic dashboard |
| **Render** | Hosting (see `render.yaml`) |

The AI never decides money. Mistake detection and plan numbers are rules; the AI explains and writes. If no AI key is set, the app still works with rule-based text and a keyword fallback for the ask box.

## Run it yourself
Requirements: Node 20+.

```bash
cd web
npm install
cp ../.env.example ../.env     # then fill in the values below
ln -s ../.env .env.local        # lets Next.js read the shared .env
npm run dev                     # http://localhost:3000
```

Values for `.env`:
- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`: a PayPal **sandbox** app (developer.paypal.com > Apps & Credentials). Turn on **Subscriptions** and **Invoicing** for the app.
- `PAYPAL_SANDBOX_BUSINESS_EMAIL`, `PAYPAL_SANDBOX_PERSONAL_EMAIL`: two sandbox accounts, **region United States** (an India-region sandbox account cannot send USD invoices).
- `GEMINI_API_KEY` (optional): free key from aistudio.google.com.
- `APP_URL`: `http://localhost:3000` locally, the public URL when deployed.

Try it: open `/`, choose Ethan, check the bill, set a budget, send it to the clinic's agent, approve, then approve the plan on PayPal's page by logging in as the sandbox personal account. Open `/clinic` in another tab to see the clinic side.

## Test accounts for judges
See the Devpost submission notes for the sandbox patient login. Payments are test money only.

## License
MIT. See [LICENSE](LICENSE).
