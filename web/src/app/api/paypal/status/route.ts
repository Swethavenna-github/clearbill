import { getSubscription, PayPalNotConfigured } from "@/lib/paypal";
import { cases, upsertCase } from "@/lib/store";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const billId = url.searchParams.get("bill") || "";
  const c = cases.get(billId);
  const id = url.searchParams.get("subscription_id") || c?.subscriptionId;
  if (!id) return Response.json({ error: "No subscription yet." }, { status: 404 });
  try {
    const s = await getSubscription(id);
    if (s.status === "ACTIVE" && c) upsertCase({ id: billId, status: "Plan active" });
    return Response.json({ subscription: s });
  } catch (e) {
    const status = e instanceof PayPalNotConfigured ? 503 : 502;
    return Response.json({ error: (e as Error).message }, { status });
  }
}
