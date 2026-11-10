# Compliance and Risk Notes

Clearbill is a hackathon prototype built for the PayPal + AI Hackathon (2026). This page states what it is, what it is not, and what a real launch would require. It is not legal advice.

## What the demo is
- A billing-clarity and payment-plan tool: it explains a medical bill in plain language, flags likely billing mistakes, and sets up an installment plan through the PayPal **sandbox**.
- All patients, clinics, bills and payments are **fictional**. No real patient information is used or stored. All money is sandbox money.

## What the demo is not
- **Not a medical device.** It does not diagnose, treat or give clinical advice, so FDA clearance or approval does not apply to this scope.
- **Not a covered entity or business associate.** With synthetic data only, HIPAA is not triggered by the demo.
- **Not legal, billing or financial advice.** The explanations are informational. Patients should confirm findings with the clinic or their insurer.

## PayPal acceptable-use policy (checked 2026-10-27)
- PayPal's Acceptable Use Policy lists "Medical Items or Services" (services by a provider of health-care services) as an activity that **requires pre-approval** from PayPal.
- It also restricts payment processors that collect payments on behalf of merchants, and lists payment-facilitator and escrow-type services as needing approval.
- Implication for a real launch: each clinic would connect **its own approved PayPal merchant account**, and Clearbill would not hold or pool funds. In the demo, a sandbox merchant account plays the clinic. Source: paypal.com/us/legalhub/paypal/acceptableuse-full.

## What a real launch would need
1. HIPAA: Business Associate Agreements with every clinic and every vendor that touches patient data; encryption in transit and at rest; access controls and audit logs; minimum-necessary data use; breach procedures.
2. Vendor review: free hackathon tiers (search, agent platform, hosting) generally do not include BAAs, so production would use compliant plans.
3. PayPal: pre-approval for the clinic merchant accounts as described above.
4. Debt collection rules if Clearbill ever collected on behalf of a clinic.
5. Consumer health-data privacy laws for any direct-to-patient app handling data outside HIPAA.
6. Insurance and billing accuracy review by qualified billing professionals before telling patients a charge is wrong.
7. Accessibility (screen-reader support, plain-language reading level) for patients.

## Data used
- `data/fake-bills/`: hand-built synthetic bills with planted errors and an answer key. Diagnosis codes are public ICD-10-CM codes. No AMA CPT codes are used.

## Privacy and security safeguards built into the prototype
These show the shape of a real system. They do **not** make the prototype HIPAA compliant: it uses fictional data, an in-memory store, a demo one-time code and no vendor agreements.

| Safeguard | What the prototype does | What a real launch adds |
|---|---|---|
| Staff sign-in | Phone number plus one-time code. The demo shows the code on screen instead of texting it. | Real SMS or authenticator app, an identity provider, MFA policy |
| Roles (minimum necessary) | Billing admin sees money, plans, analytics and the audit log. Front desk sees patients and requests but no amounts. | Finer roles, reviewed regularly |
| Session limits | Cookie is HttpOnly and lasts 20 minutes; the page signs out after 10 idle minutes. | Server-side session store, shorter timeouts for shared computers |
| Lockout | 5 wrong codes lock that number for 5 minutes. Sign-in replies do not reveal which numbers are staff. | Rate limits by IP and device, alerts |
| Masked data | Patient lists show "Ethan C." and "+1 ••• ••• 6789". Full details need a deliberate "Show details" click. | Field-level encryption, break-glass approval |
| Audit log | Records who signed in, searched, registered, revealed or approved, and when. It stores no names, numbers or search text. Only admins can read it. | Tamper-proof storage, retention policy, review process |
| Registration control | Patients can only request registration. Staff approve it. The request form gives the same reply whether or not a number is registered. | Identity checks at the front desk |
| Patient data access | A patient can open only their own bills. The answer key for test bills never leaves the server. | Per-record access checks backed by a database |
| Data minimization | Fictional data only. Photos of bills are read by an AI model and not stored on our server. | Business associate agreements with every vendor, encryption at rest, no real data in third-party AI without agreements |

Demo staff numbers: 987 654 321 (billing admin) and 987 654 322 (front desk). Demo code: 246810. Demo patient number: 123 456 789.

## Honest limits
- The PayPal sandbox cannot reproduce real clinic payments or real disputes.
- Billing-error detection is a heuristic and can be wrong. The agent shows its reasoning and asks a human to confirm before any refund or plan is sent.
