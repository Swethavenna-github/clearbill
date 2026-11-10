import type { Deal, Finding, Round } from "./types";

export type CaseRecord = {
  id: string;
  billId: string;
  patient: string;
  initials: string;
  billed: number;
  corrected: number;
  target: number;
  findings: Finding[];
  rounds: Round[];
  deal: Deal | null;
  status: "Flagged" | "Plan proposed" | "Clinic approved" | "Plan active";
  invoiceNumber?: string;
  subscriptionId?: string;
  sample?: boolean; // fictional history shown so the clinic side is not empty; not counted in money totals
  updatedAt: string;
};

// ageDays means "days past due": 0 for a plan that is up to date, more for a late one.
export type PlanRow = {
  initials: string;
  plan: string;
  balance: number;
  monthly: number;
  nextPayment: string;
  status: "On track" | "Late" | "New";
  ageDays: number;
};

// A few fictional accounts for the clinic's other patients, so the dashboard is not empty. Ethan's plans come
// from lib/plans.ts so the patient app and this dashboard show the same numbers.
export const seededPlans: PlanRow[] = [
  { initials: "J.O.", plan: "Ankle sprain visit", balance: 160, monthly: 40, nextPayment: "Nov 15", status: "On track", ageDays: 0 },
  { initials: "A.K.", plan: "Appendectomy stay", balance: 2650, monthly: 200, nextPayment: "Nov 18", status: "On track", ageDays: 0 },
  { initials: "T.N.", plan: "Physical therapy", balance: 1450, monthly: 100, nextPayment: "Oct 24", status: "Late", ageDays: 17 },
  { initials: "D.B.", plan: "Back MRI", balance: 510, monthly: 50, nextPayment: "Nov 20", status: "On track", ageDays: 0 },
  { initials: "E.P.", plan: "Diabetes follow-up", balance: 50, monthly: 25, nextPayment: "Nov 22", status: "On track", ageDays: 0 },
  { initials: "R.M.", plan: "Emergency visit", balance: 3200, monthly: 150, nextPayment: "Sep 23", status: "Late", ageDays: 48 },
  { initials: "S.W.", plan: "Surgery deposit", balance: 980, monthly: 75, nextPayment: "Aug 28", status: "Late", ageDays: 74 },
];

export const seededTotals = { billed: 61480, collected: 38210, corrected: 2140 };

const g = globalThis as unknown as { __clearbillCases?: Map<string, CaseRecord> };
export const cases: Map<string, CaseRecord> = (g.__clearbillCases ??= new Map());

export function upsertCase(c: Partial<CaseRecord> & { id: string }) {
  const prev = cases.get(c.id);
  const next = { ...(prev || ({} as CaseRecord)), ...c, updatedAt: new Date().toISOString() } as CaseRecord;
  cases.set(c.id, next);
  return next;
}
