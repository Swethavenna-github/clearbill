import type { Bill, ClinicRules, Line } from "./types";

// A bill typed in by the user (fictional data only). It is checked, cleaned and turned into the same
// Bill shape as the sample bills, so the same rules, AI review, negotiation and PayPal code all work.
export type CustomInput = {
  id: string;
  patientName: string;
  provider: string;
  dateOfService: string;
  dischargeDate?: string;
  lines: { description: string; quantity: number; amount: number }[];
  insuranceStatus: "paid" | "denied" | "not_sent" | "none";
  insurancePaid?: number;
  balanceShown?: number;
  outOfPocketMax?: number;
  notes?: string;
};

const DEFAULT_RULES: ClinicRules = {
  min_monthly: 50,
  max_months: 24,
  preferred_months: 12,
  round_monthly_up_to: 25,
  interest: 0,
  can_waive_late_fees: true,
  financial_assistance_available: true,
};

const clean = (s: unknown, max: number) => String(s ?? "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v));
const money = (n: number) => Math.round(n * 100) / 100;
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s).getTime());

function codeFor(description: string): string {
  if (/room|board|bed|night|inpatient stay/i.test(description)) return "RM-CUSTOM";
  if (/emergency|\ber\b|trauma/i.test(description)) return "ER-CUSTOM";
  return "X-" + description.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24);
}

export function normalizeCustom(input: CustomInput): { bill?: Bill; error?: string } {
  if (!input || typeof input !== "object") return { error: "Missing bill." };
  const id = clean(input.id, 40);
  if (!/^[A-Za-z0-9_-]{3,40}$/.test(id)) return { error: "Bad bill id." };
  const provider = clean(input.provider, 80);
  if (!provider) return { error: "Add the hospital or clinic name." };
  const dos = clean(input.dateOfService, 10);
  if (!isDate(dos)) return { error: "Add the date of the visit." };
  const dis = clean(input.dischargeDate, 10);
  if (dis && !isDate(dis)) return { error: "The go-home date is not a valid date." };
  if (dis && new Date(dis) < new Date(dos)) return { error: "The go-home date is before the visit date." };

  const rawLines = Array.isArray(input.lines) ? input.lines.slice(0, 20) : [];
  const lines: Line[] = [];
  for (const l of rawLines) {
    const description = clean(l?.description, 80);
    const amount = money(num(l?.amount));
    const qty = Math.round(num(l?.quantity) || 1);
    if (!description && !(amount > 0)) continue; // ignore empty rows
    if (!description) return { error: "Each charge needs a description." };
    if (!(amount > 0) || amount > 1_000_000) return { error: `Check the amount for "${description}".` };
    if (!(qty >= 1 && qty <= 60)) return { error: `Check the quantity for "${description}".` };
    lines.push({ line: lines.length + 1, internal_code: codeFor(description), description, quantity: qty, charge: amount });
  }
  if (lines.length === 0) return { error: "Add at least one charge." };

  const total = money(lines.reduce((s, l) => s + l.charge, 0));
  const status = input.insuranceStatus;
  if (!["paid", "denied", "not_sent", "none"].includes(status)) return { error: "Choose what happened with insurance." };
  let paid = 0;
  let note = "No insurance";
  if (status === "paid") {
    paid = money(num(input.insurancePaid));
    if (!(paid > 0) || paid > total) return { error: "Insurance paid must be more than $0 and not more than the total." };
    note = `Paid $${paid.toLocaleString("en-US")}`;
  } else if (status === "denied") note = "Claim denied: prior authorization not on file";
  else if (status === "not_sent") note = "Not billed to insurance";

  const balanceRaw = num(input.balanceShown);
  const balance = Number.isFinite(balanceRaw) && balanceRaw >= 0 ? money(balanceRaw) : money(total - paid);
  const oop = num(input.outOfPocketMax);
  const insurance = oop > 0 && oop <= 100000 ? `plan with a $${Math.round(oop).toLocaleString("en-US")} yearly out-of-pocket maximum` : status === "none" ? "uninsured" : "plan details not given";
  const name = clean(input.patientName, 60) || "Patient";

  return {
    bill: {
      bill_id: id,
      title: provider,
      patient: { name, age: 0, occupation: "", insurance },
      provider: { name: provider, type: "hospital or clinic" },
      date_of_service: dos,
      ...(dis ? { discharge_date: dis } : {}),
      line_items: lines,
      total_charges: total,
      insurance: { note, paid, contractual_adjustment: 0 },
      patient_responsibility_as_billed: balance,
      bill_notes: clean(input.notes, 300),
      correct_patient_responsibility: null,
      negotiation_context: { patient_monthly_budget: 150, clinic_rules: DEFAULT_RULES },
    },
  };
}
