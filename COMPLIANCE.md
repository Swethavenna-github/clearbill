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

## Honest limits
- The PayPal sandbox cannot reproduce real clinic payments or real disputes.
- Billing-error detection is a heuristic and can be wrong. The agent shows its reasoning and asks a human to confirm before any refund or plan is sent.
