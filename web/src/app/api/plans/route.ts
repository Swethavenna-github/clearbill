import { samplePlans } from "@/lib/plans";

// GET /api/plans?user=ethan -> sample (fictional) active installment plans for that registered patient
export async function GET(req: Request) {
  const user = new URL(req.url).searchParams.get("user") || "";
  return Response.json({ plans: samplePlans(user) });
}
