import type { Bill, Finding } from "./types";

const money = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function nightsBetween(a: string, b: string) {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.round(ms / 86400000);
}

// Rule-based checks. The rules find the problems; the AI only explains them in plain words.
export function auditBill(bill: Bill): Finding[] {
  const out: Finding[] = [];
  const items = bill.line_items;

  // 1. Same service charged twice
  const seen = new Map<string, number>();
  for (const l of items) {
    const key = `${l.internal_code}|${l.description}|${l.charge}`;
    if (seen.has(key) && l.quantity === 1) {
      const first = seen.get(key)!;
      out.push({
        id: "dup-" + l.line,
        type: "duplicate_charge",
        title: "Charged twice for the same thing",
        lines: [first, l.line],
        confidence: "high",
        explain: `"${l.description}" appears on lines ${first} and ${l.line} with the same price. The hospital record shows it was done once.`,
        fix: `Ask the hospital to remove line ${l.line}.`,
        savings: l.charge,
      });
    } else seen.set(key, l.line);
  }

  // 2. Hospital nights billed vs nights actually stayed
  if (bill.discharge_date) {
    const stayed = nightsBetween(bill.date_of_service, bill.discharge_date);
    for (const l of items) {
      if (l.internal_code.startsWith("RM") && l.quantity > stayed && stayed > 0) {
        const perNight = l.charge / l.quantity;
        out.push({
          id: "night-" + l.line,
          type: "billed_for_extra_night",
          title: "Billed for a night you were not there",
          lines: [l.line],
          confidence: "high",
          explain: `You arrived ${bill.date_of_service} and went home ${bill.discharge_date}. That is ${stayed} nights, but ${l.quantity} nights are billed.`,
          fix: `Reduce the room charge to ${stayed} nights (${money(perNight * stayed)}).`,
          savings: Math.round(perNight * (l.quantity - stayed) * 100) / 100,
        });
      }
    }
  }

  // 3. Insurance paid but the balance did not drop
  if (bill.insurance.paid > 0 && bill.patient_responsibility_as_billed >= bill.total_charges - 0.005) {
    out.push({
      id: "ins-applied",
      type: "insurance_payment_not_applied",
      title: "Insurance paid, but your balance did not go down",
      lines: [],
      confidence: "high",
      explain: `Insurance paid ${money(bill.insurance.paid)}, yet the balance still shows the full charges.`,
      fix: `Ask the clinic to subtract the insurance payment. Your balance should be ${money(bill.total_charges - bill.insurance.paid - bill.insurance.contractual_adjustment)}.`,
      savings: bill.insurance.paid,
    });
  }

  // 4. Out-of-network doctor at an in-network hospital
  for (const l of items) {
    if (/out-of-network/i.test(l.description)) {
      out.push({
        id: "oon-" + l.line,
        type: "out_of_network_balance_bill",
        title: "Possible surprise out-of-network charge",
        lines: [l.line],
        confidence: "medium",
        explain: "A doctor group outside your insurance network treated you at a hospital that is in your network. In many cases the law limits what you can be charged for this (the No Surprises Act).",
        fix: "Ask your insurer to reprocess this line at the in-network rate, and ask the hospital to hold this charge until they do.",
        savings: null,
      });
    }
  }

  // 5. Emergency care denied for missing prior authorization
  const hasER = items.some((l) => l.internal_code.startsWith("ER"));
  if (hasER && /denied/i.test(bill.insurance.note) && /prior authorization/i.test(bill.insurance.note)) {
    out.push({
      id: "denial-er",
      type: "insurance_denial_emergency_prior_auth",
      title: "Insurance denied your emergency care",
      lines: [],
      confidence: "medium",
      explain: "Your insurer denied the claim because 'prior authorization' was missing. Emergency care generally cannot require approval in advance, so this denial is likely wrong.",
      fix: "Appeal the denial with your insurer and ask the hospital to send the claim again. Confirm the details with your insurer.",
      savings: null,
    });
  }

  // 6. Routine checkup billed to the patient instead of insurance
  if (items.some((l) => /preventive/i.test(l.description)) && /not billed/i.test(bill.insurance.note)) {
    out.push({
      id: "prev",
      type: "preventive_service_billed_to_patient",
      title: "A routine checkup was billed to you",
      lines: items.map((l) => l.line),
      confidence: "medium",
      explain: "Routine preventive care is usually covered with no cost to you at an in-network clinic, but this was never sent to insurance.",
      fix: "Ask the clinic to bill your insurance. Confirm that your plan covers preventive care.",
      savings: bill.total_charges,
    });
  }

  return out;
}

// Estimated amount the patient will owe after the fixes. This is an estimate, not a promise.
export function estimateShare(bill: Bill, findings: Finding[]) {
  const sure = findings.filter((f) => f.confidence === "high");
  const corrected = correctedCharges(bill, findings);
  const denial = findings.find((f) => f.type === "insurance_denial_emergency_prior_auth");
  const oop = bill.patient.insurance.match(/\$([\d,]+) yearly out-of-pocket maximum/);
  if (denial && oop) {
    const cap = Number(oop[1].replace(/,/g, ""));
    return { amount: Math.min(cap, corrected), basis: `If the insurer reprocesses the claim, your share is capped at your ${money(cap)} yearly out-of-pocket maximum.` };
  }
  let base = bill.patient_responsibility_as_billed;
  if (sure.some((f) => f.type === "insurance_payment_not_applied")) {
    base = bill.total_charges - bill.insurance.paid - bill.insurance.contractual_adjustment;
  }
  const removed = sure
    .filter((f) => f.type === "duplicate_charge" || f.type === "billed_for_extra_night")
    .reduce((s, f) => s + (f.savings ?? 0), 0);
  return { amount: Math.max(0, Math.round((base - removed) * 100) / 100), basis: "Your balance after the corrections above." };
}

export function correctedCharges(bill: Bill, findings: Finding[]) {
  const sure = findings
    .filter((f) => f.confidence === "high" && (f.type === "duplicate_charge" || f.type === "billed_for_extra_night"))
    .reduce((s, f) => s + (f.savings ?? 0), 0);
  return Math.round((bill.total_charges - sure) * 100) / 100;
}
