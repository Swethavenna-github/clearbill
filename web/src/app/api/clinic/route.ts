import { cases, seededPlans, seededTotals, upsertCase } from "@/lib/store";

export async function GET() {
  const live = Array.from(cases.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const liveBilled = live.reduce((s, c) => s + c.billed, 0);
  const liveCorrected = live.reduce((s, c) => s + (c.billed - c.corrected > 0 ? c.billed - c.corrected : 0), 0);
  const liveCollected = live.filter((c) => c.status === "Plan active").reduce((s, c) => s + (c.deal?.monthly ?? 0), 0);

  const plans = [
    ...live
      .filter((c) => c.deal)
      .map((c) => ({
        initials: c.initials,
        balance: c.target,
        monthly: c.deal!.monthly,
        nextPayment: c.status === "Plan active" ? "Next month" : "Pending",
        status: c.status === "Plan active" ? ("On track" as const) : ("New" as const),
        ageDays: 0,
        live: true,
      })),
    ...seededPlans.map((p) => ({ ...p, live: false })),
  ];

  const buckets = [
    { label: "0 to 30 days", min: 0, max: 30 },
    { label: "31 to 60 days", min: 31, max: 60 },
    { label: "61 to 90 days", min: 61, max: 90 },
    { label: "90+ days", min: 91, max: 9999 },
  ].map((b) => ({
    label: b.label,
    amount: plans.filter((p) => p.ageDays >= b.min && p.ageDays <= b.max).reduce((s, p) => s + p.balance, 0),
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
    queue: live.map((c) => ({
      id: c.id,
      patient: c.patient,
      billed: c.billed,
      findings: c.findings.map((f) => ({ title: f.title, confidence: f.confidence, savings: f.savings })),
      deal: c.deal,
      status: c.status,
      invoiceNumber: c.invoiceNumber,
    })),
    log: live.flatMap((c) => c.rounds.map((r) => ({ case: c.patient, ...r }))),
  });
}

export async function POST(req: Request) {
  const { caseId } = (await req.json()) as { caseId: string };
  const c = cases.get(caseId);
  if (!c) return Response.json({ error: "Unknown case" }, { status: 404 });
  if (c.status === "Plan proposed" || c.status === "Flagged") upsertCase({ id: caseId, status: "Clinic approved" });
  return Response.json({ ok: true });
}
