# Fake bills (synthetic)

All patients, clinics, dates and charges are **fictional**. They exist to test the bill explainer and the payment-plan negotiation. No real patient information.

Each JSON file has: the printed bill, an `answer_key` of planted errors (for testing, not shown to the agent), the correct patient responsibility, and `negotiation_context` (patient monthly budget and the clinic's payment-plan rules).

| ID | Story | Patient | Billed to patient | Planted error |
|---|---|---|---|---|
| B01 | Emergency visit, chest pain | Maria Lopez | $3847.20 | duplicate_charge |
| B02 | Urgent care, ankle sprain | James Okafor | $460.00 | insurance_payment_not_applied |
| B03 | Annual checkup billed to the patient | Priya Raman | $445.00 | preventive_service_billed_to_patient |
| B04 | MRI, lower back, with a surprise out-of-network charge | Daniel Brooks | $510.00 | out_of_network_balance_bill |
| B05 | Appendectomy, hospital stay billed for an extra night | Aisha Khan | $2650.00 | billed_for_extra_night |
| B06 | Physical therapy, sessions billed that were not attended | Tom Nguyen | $1740.00 | billed_for_sessions_not_attended |
| B07 | Diabetes follow-up (clean control bill, no errors) | Elena Petrova | $50.00 | none (control) |
| B08 | Screening colonoscopy coded as diagnostic | Marcus Hill | $960.00 | screening_coded_as_diagnostic |
| B09 | Cycling accident, emergency surgery, insurance denied | Ethan Cole | $43,110.00 | duplicate_charge, billed_for_extra_night, insurance_denial_emergency_prior_auth, out_of_network_balance_bill |

Notes
- **B09 is the hero bill for the demo video** (Ethan, cycling accident, $43,110.00). B01 (Maria) is kept as a smaller backup sample. Ethan's plan: after insurance reprocessing his share is capped at $4,500; $4,500 over 18 months is $250 a month.
- B07 is a clean control. The agent must say the bill looks correct and not invent errors.
- Diagnosis codes are public ICD-10-CM codes. No AMA CPT codes are used.
- B03, B04 and B08 are marked medium confidence on purpose: the agent should say "ask the clinic or insurer to check", not "this is wrong".
- Clinic rules: `min_monthly`, `max_months`, `preferred_months`, and `round_monthly_up_to` drive the counter-offer. Example: B01 corrected balance $3,435.20 over 20 months is $171.76, rounded up to $175.
