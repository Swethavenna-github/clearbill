import { getBill } from "./bills";
import { auditBill, correctedCharges, estimateShare } from "./audit";
import { negotiate } from "./negotiate";
import { cases, type CaseRecord } from "./store";

// Fictional history for the clinic side: patients who already flagged a bill and talked to the clinic's agent.
// The findings and the agents' messages come from the real rule engines, so they look exactly like live ones.
// These cases are marked "sample": they fill the queue and the conversation log but are not counted in the money totals.
const g = globalThis as unknown as { __cbCasesSeeded?: boolean };

const SAMPLES: { billId: string; budget: number | null; status: CaseRecord["status"]; hoursAgo: number }[] = [
  { billId: "B01", budget: 150, status: "Plan proposed", hoursAgo: 3 },
  { billId: "B05", budget: 200, status: "Plan proposed", hoursAgo: 9 },
  { billId: "B03", budget: null, status: "Flagged", hoursAgo: 14 },
  { billId: "B04", budget: 50, status: "Clinic approved", hoursAgo: 30 },
  { billId: "B02", budget: 40, status: "Plan active", hoursAgo: 52 },
];

export function ensureSeededCases() {
  if (g.__cbCasesSeeded) return;
  g.__cbCasesSeeded = true;
  for (const s of SAMPLES) {
    const bill = getBill(s.billId);
    if (!bill || cases.has(bill.bill_id)) continue;
    const findings = auditBill(bill);
    const share = estimateShare(bill, findings);
    const result = s.budget !== null && share.amount > 0 ? negotiate(share.amount, s.budget, bill.negotiation_context.clinic_rules) : null;
    cases.set(bill.bill_id, {
      id: bill.bill_id,
      billId: bill.bill_id,
      patient: bill.patient.name,
      initials: bill.patient.name
        .split(" ")
        .map((p) => p[0] + ".")
        .join(""),
      billed: bill.total_charges,
      corrected: correctedCharges(bill, findings),
      target: share.amount,
      findings,
      rounds: result ? result.rounds : [],
      deal: result ? result.deal : null,
      status: s.status,
      sample: true,
      updatedAt: new Date(Date.now() - s.hoursAgo * 3_600_000).toISOString(),
    });
  }
}
