import { cases, seededPlans, seededTotals, upsertCase } from "@/lib/store";
import { ethanClinicRows } from "@/lib/plans";
import { ensureSeededCases } from "@/lib/seed";
import { needStaff } from "@/lib/staff";
import { logAudit } from "@/lib/audit-log";

export async function GET(req: Request) {
  const s = needStaff(req, ["admin"]);
  if (s instanceof Response) return s;
  ensureSeededCases();
  const all = Array.from(cases.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  // Sample history fills the queue and the conversation log, but only real demo cases count in money totals and plan rows.
  const live = all.filter((c) => !c.sample);

  const liveBilled = live.reduce((t, c) => t + c.billed, 0);
  const liveCorrected = live.reduce((t, c) => t + (c.billed - c.corrected > 0 ? c.billed - c.corrected : 0), 0);
  const liveCollected = live.filter((c) => c.status === "Plan active").reduce((t, c) => t + (c.deal?.monthly ?? 0), 0);

  // Payment plans: the live demo case first, then Ethan's existing plans (the same ones his app shows), then other patients.
  const plans = [
    ...live
      .filter((c) => c.deal)
      .map((c) => ({
        initials: c.initials,
        plan: "Hospital bill (new plan)",
        balance: c.target,
        monthly: c.deal!.monthly,
        nextPayment: c.status === "Plan active" ? "Next month" : "Awaiting approval",
        status: c.status === "Plan active" ? ("On track" as const) : ("New" as const),
        ageDays: 0,
        live: true,
      })),
    ...ethanClinicRows().map((p) => ({ ...p, live: false })),
    ...seededPlans.map((p) => ({ ...p, live: false })),
  ];

  // Aging: how many days past due each plan's balance is.
  const buckets = [
    { label: "Current (not yet due)", min: 0, max: 0 },
    { label: "1 to 30 days late", min: 1, max: 30 },
    { label: "31 to 60 days late", min: 31, max: 60 },
    { label: "61 to 90 days late", min: 61, max: 90 },
    { label: "Over 90 days late", min: 91, max: 9999 },
  ].map((b) => ({
    label: b.label,
    amount: plans.filter((p) => p.ageDays >= b.min && p.ageDays <= b.max).reduce((t, p) => t + p.balance, 0),
  }));

  const billed = seededTotals.billed + liveBilled;
  const collected = seededTotals.collected + liveCollected;
  return Response.json({
    kpis: {
      billed,
      collected,
      outstanding: billed - collected,
      corrected: seededTotals.corrected + liveCorrected,
    },
    buckets,
    plans,
    queue: all.map((c) => ({
      id: c.id,
      patient: c.patient,
      billed: c.billed,
      findings: c.findings.map((f) => ({ title: f.title, confidence: f.confidence, savings: f.savings })),
      deal: c.deal,
      status: c.status,
      invoiceNumber: c.invoiceNumber,
      sample: Boolean(c.sample),
    })),
    // One line per message, tagged with the patient's initials only.
    log: all.flatMap((c) => c.rounds.map((r) => ({ case: c.initials, ...r }))),
  });
}

export async function POST(req: Request) {
  const s = needStaff(req, ["admin"]);
  if (s instanceof Response) return s;
  const { caseId } = (await req.json()) as { caseId: string };
  const c = cases.get(caseId);
  if (!c) return Response.json({ error: "Unknown case" }, { status: 404 });
  if (c.status === "Plan proposed" || c.status === "Flagged") {
    upsertCase({ id: caseId, status: "Clinic approved" });
    logAudit(s, "approved a payment plan");
  }
  return Response.json({ ok: true });
}
