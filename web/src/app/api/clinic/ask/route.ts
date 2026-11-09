import { askDashboard } from "@/lib/ai";
import { cases, seededPlans } from "@/lib/store";

export async function POST(req: Request) {
  const { question } = (await req.json()) as { question: string };
  if (!question || question.length > 300) return Response.json({ error: "Ask a short question about the payment plans." }, { status: 400 });
  const live = Array.from(cases.values())
    .filter((c) => c.deal)
    .map((c) => ({ initials: c.initials, balance: c.target, monthly: c.deal!.monthly, nextPayment: "Pending", status: c.status === "Plan active" ? "On track" : "New", ageDays: 0 }));
  const result = await askDashboard(question, [...live, ...seededPlans]);
  return Response.json(result);
}
