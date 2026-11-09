import { getBill } from "@/lib/bills";
import { auditBill, correctedCharges, estimateShare } from "@/lib/audit";
import { negotiate } from "@/lib/negotiate";
import { agentMessage } from "@/lib/ai";
import { upsertCase } from "@/lib/store";

export async function POST(req: Request) {
  const { billId, budget } = (await req.json()) as { billId: string; budget: number };
  const bill = getBill(billId);
  if (!bill) return Response.json({ error: "Unknown bill" }, { status: 404 });
  const monthlyBudget = Math.max(10, Math.round(Number(budget) || 0));

  // The target is recomputed on the server so the browser cannot set it.
  const findings = auditBill(bill);
  const share = estimateShare(bill, findings);
  if (share.amount <= 0) {
    return Response.json({ error: "Nothing to pay after the corrections. Ask the clinic to review the bill." }, { status: 400 });
  }
  const { rounds, deal } = negotiate(share.amount, monthlyBudget, bill.negotiation_context.clinic_rules);

  // Each agent says its decision in its own words. The numbers come from the rules.
  const facts =
    `Patient: ${bill.patient.name}, ${bill.patient.age}, ${bill.patient.occupation}. Balance after corrections: $${share.amount}. ` +
    `Patient's monthly budget: $${monthlyBudget}. Clinic rules: preferred plan up to ${bill.negotiation_context.clinic_rules.preferred_months} months, longest ${bill.negotiation_context.clinic_rules.max_months} months, no interest.`;
  const spoken: typeof rounds = [];
  for (const r of rounds) {
    spoken.push({ ...r, message: await agentMessage(r.from, facts, r.message) });
  }

  upsertCase({
    id: bill.bill_id,
    billId: bill.bill_id,
    patient: bill.patient.name,
    initials: bill.patient.name
      .split(" ")
      .map((p) => p[0] + ".")
      .join(""),
    billed: bill.total_charges,
    corrected: correctedCharges(bill, findings),
    findings,
    rounds: spoken,
    deal,
    target: share.amount,
    status: "Plan proposed",
  });
  return Response.json({ target: share.amount, rounds: spoken, deal, rules: bill.negotiation_context.clinic_rules });
}
