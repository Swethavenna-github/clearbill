import type { PlanRow } from "./store";

// Ethan's existing installment plans with Riverbend (fictional). The patient app and the clinic dashboard
// both read these, so the two always show the same numbers. Dates are worked out from today.
export type SamplePlan = {
  id: string;
  provider: string;
  title: string;
  monthly: number;
  months: number;
  paid: number;
  dueDay: number;
  thisMonthDue: string; // YYYY-MM-DD, the instalment that falls in the current month
  thisMonthState: "paid" | "upcoming";
  nextDue: string; // next unpaid instalment
  status: "ACTIVE";
  demo: true;
};

const iso = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d, 12)).toISOString().slice(0, 10);
const PROVIDER = "Riverbend Community Hospital";

export function samplePlans(userId: string, now = new Date()): SamplePlan[] {
  if (userId !== "ethan") return [];
  const y = now.getFullYear();
  const m = now.getMonth();
  const today = now.getDate();
  const seeds = [
    { id: "sample-ortho", title: "Orthopedic follow-up visits", monthly: 60, months: 12, paidBefore: 3, dueDay: 15 },
    { id: "sample-pt", title: "Physical therapy sessions", monthly: 45, months: 6, paidBefore: 4, dueDay: 22 },
    { id: "sample-lab", title: "Pre-surgery lab work", monthly: 30, months: 4, paidBefore: 1, dueDay: 5 },
  ];
  return seeds.map((s) => {
    const paidThisMonth = s.dueDay < today;
    const thisMonthDue = iso(y, m, s.dueDay);
    return {
      id: s.id,
      provider: PROVIDER,
      title: s.title,
      monthly: s.monthly,
      months: s.months,
      paid: s.paidBefore + (paidThisMonth ? 1 : 0),
      dueDay: s.dueDay,
      thisMonthDue,
      thisMonthState: paidThisMonth ? ("paid" as const) : ("upcoming" as const),
      nextDue: paidThisMonth ? iso(y, m + 1, s.dueDay) : thisMonthDue,
      status: "ACTIVE" as const,
      demo: true as const,
    };
  });
}

const label = (isoDate: string) => new Date(isoDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

// The same plans as rows for the clinic dashboard's payment plans table.
export function ethanClinicRows(now = new Date()): PlanRow[] {
  return samplePlans("ethan", now).map((p) => ({
    initials: "E.C.",
    plan: p.title,
    balance: Math.max(0, (p.months - p.paid) * p.monthly),
    monthly: p.monthly,
    nextPayment: label(p.nextDue),
    status: "On track" as const,
    ageDays: 0,
  }));
}
