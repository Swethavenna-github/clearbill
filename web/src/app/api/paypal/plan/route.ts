import { getBill } from "@/lib/bills";
import { auditBill, estimateShare } from "@/lib/audit";
import { createInstallmentPlan, PayPalNotConfigured } from "@/lib/paypal";
import { upsertCase } from "@/lib/store";

export async function POST(req: Request) {
  const { billId, monthly, months } = (await req.json()) as { billId: string; monthly: number; months: number };
  const bill = getBill(billId);
  if (!bill) return Response.json({ error: "Unknown bill" }, { status: 404 });
  const patientEmail = process.env.PAYPAL_SANDBOX_PERSONAL_EMAIL;
  if (!patientEmail) {
    return Response.json({ error: "Set PAYPAL_SANDBOX_PERSONAL_EMAIL in .env (the sandbox patient account email)." }, { status: 503 });
  }
  const target = estimateShare(bill, auditBill(bill)).amount;
  const m = Math.round(Number(monthly) * 100) / 100;
  const n = Math.round(Number(months));
  const rules = bill.negotiation_context.clinic_rules;
  if (!(m >= rules.min_monthly) || !(n >= 1) || n > rules.max_months) {
    return Response.json({ error: "That plan is outside the clinic's rules." }, { status: 400 });
  }
  // Exact payments: n-1 full payments plus a final payment for the remainder.
  const last = Math.round((target - m * (n - 1)) * 100) / 100;
  if (last <= 0 || last > m + 0.005) return Response.json({ error: "That plan does not add up to the balance." }, { status: 400 });
  const same = Math.abs(last - m) < 0.005;
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const [first, ...rest] = bill.patient.name.split(" ");
  try {
    const plan = await createInstallmentPlan({
      planName: `Clearbill plan for ${bill.patient.name}`,
      monthly: m,
      fullCycles: same ? n : n - 1,
      lastPayment: same ? m : last,
      patientFirst: first,
      patientLast: rest.join(" ") || "Patient",
      patientEmail,
      returnUrl: `${appUrl}/?paid=1&bill=${bill.bill_id}`,
      cancelUrl: `${appUrl}/?cancelled=1&bill=${bill.bill_id}`,
    });
    upsertCase({ id: bill.bill_id, subscriptionId: plan.subscriptionId });
    return Response.json({ plan, monthly: m, months: n, lastPayment: same ? m : last });
  } catch (e) {
    const status = e instanceof PayPalNotConfigured ? 503 : 502;
    return Response.json({ error: (e as Error).message }, { status });
  }
}
