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
  updatedAt: string;
};

export type PlanRow = {
  initials: string;
  balance: number;
  monthly: number;
  nextPayment: string;
  status: "On track" | "Late" | "New";
  ageDays: number;
};

// A few fictional accounts so the dashboard is not empty before the live demo case arrives.
export const seededPlans: PlanRow[] = [
  { initials: "J.O.", balance: 160, monthly: 40, nextPayment: "Nov 15", status: "On track", ageDays: 12 },
  { initials: "A.K.", balance: 2650, monthly: 200, nextPayment: "Nov 18", status: "On track", ageDays: 28 },
  { initials: "T.N.", balance: 1450, monthly: 100, nextPayment: "Nov 5", status: "Late", ageDays: 47 },
  { initials: "D.B.", balance: 510, monthly: 50, nextPayment: "Nov 20", status: "On track", ageDays: 8 },
  { initials: "E.P.", balance: 50, monthly: 25, nextPayment: "Nov 22", status: "On track", ageDays: 5 },
  { initials: "R.M.", balance: 3200, monthly: 150, nextPayment: "Oct 28", status: "Late", ageDays: 78 },
  { initials: "S.W.", balance: 980, monthly: 75, nextPayment: "Nov 9", status: "Late", ageDays: 104 },
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
