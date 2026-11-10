import { resolveBill } from "@/lib/bills";
import { auditBill, estimateShare } from "@/lib/audit";
import { createInvoice, PayPalNotConfigured } from "@/lib/paypal";
import { upsertCase } from "@/lib/store";

export async function POST(req: Request) {
  const body = await req.json();
  const { bill, error } = resolveBill(body);
  if (!bill) return Response.json({ error }, { status: 400 });
  const patientEmail = process.env.PAYPAL_SANDBOX_PERSONAL_EMAIL;
  if (!patientEmail) {
    return Response.json({ error: "Set PAYPAL_SANDBOX_PERSONAL_EMAIL in .env (the sandbox patient account email)." }, { status: 503 });
  }
  const share = estimateShare(bill, auditBill(bill));
  const [first, ...rest] = bill.patient.name.split(" ");
  try {
    const inv = await createInvoice({
      clinicName: bill.provider.name.replace(" (fictional)", ""),
      clinicEmail: process.env.PAYPAL_SANDBOX_BUSINESS_EMAIL,
      patientFirst: first,
      patientLast: rest.join(" ") || "Patient",
      patientEmail,
      itemName: "Corrected patient statement",
      itemDescription: `Visit ${bill.date_of_service}. ${share.basis}`,
      amount: share.amount,
      note: "Demo with fictional data. Corrected after Clearbill checked the bill. Pay in full, or use the monthly plan.",
    });
    upsertCase({ id: bill.bill_id, invoiceNumber: inv.number });
    return Response.json({ invoice: inv, amount: share.amount });
  } catch (e) {
    const status = e instanceof PayPalNotConfigured ? 503 : 502;
    return Response.json({ error: (e as Error).message }, { status });
  }
}
