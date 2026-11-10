import { askDashboard } from "@/lib/ai";
import { cases, seededPlans } from "@/lib/store";
import { ethanClinicRows } from "@/lib/plans";
import { needStaff } from "@/lib/staff";
import { logAudit } from "@/lib/audit-log";

export async function POST(req: Request) {
  const s = needStaff(req, ["admin"]);
  if (s instanceof Response) return s;
  const { question } = (await req.json()) as { question: string };
  if (!question || question.length > 300) return Response.json({ error: "Ask a short question about the payment plans." }, { status: 400 });
  const live = Array.from(cases.values())
    .filter((c) => c.deal)
    .map((c) => ({ initials: c.initials, plan: "Hospital bill (new plan)", balance: c.target, monthly: c.deal!.monthly, nextPayment: "Awaiting approval", status: c.status === "Plan active" ? "On track" : "New", ageDays: 0 }));
  const result = await askDashboard(question, [...live, ...ethanClinicRows(), ...seededPlans]);
  logAudit(s, "asked the data assistant", `${result.rows.length} rows`);
  return Response.json(result);
}
