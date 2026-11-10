import type { Metadata } from "next";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { staffFromCookies } from "@/lib/staff";
import { logAudit } from "@/lib/audit-log";
import { getDashboardData, type DashboardData } from "@/lib/dashboard-data";
import { getSubscription } from "@/lib/paypal";
import { cases, seededPlans } from "@/lib/store";
import { samplePlans } from "@/lib/plans";
import { BillingDesk, type SubRow } from "./billing-desk";

export const metadata: Metadata = { title: "Billing desk" };

// Billing desk: the clinic's PayPal business account (sandbox). Money received, invoices and the
// EMI plans patients agreed to. Read live from PayPal on every visit.
export default async function BillingPage() {
  await connection();
  const staff = await staffFromCookies();
  if (!staff) redirect("/clinic/login");
  // Money is shown to billing admins only (front desk staff see patients and requests, not amounts).
  if (staff.role !== "admin") {
    return (
      <div className="dash">
        <div className="panel"><h2>Billing desk</h2><div className="muted">This section is for billing admins. Your role (front desk) can register patients and handle requests.</div><a className="btn sm" style={{ marginTop: 10 }} href="/clinic">Back to the clinic page</a></div>
      </div>
    );
  }
  logAudit(staff, "opened billing desk");
  let data: DashboardData | null = null;
  let error = "";
  try {
    data = await getDashboardData();
  } catch (e) {
    error = (e as Error).message;
  }

  // EMI plans created through this app: ask PayPal for the live status of each.
  const subs: SubRow[] = [];
  for (const c of cases.values()) {
    if (!c.subscriptionId || !c.deal) continue;
    try {
      const s = await getSubscription(c.subscriptionId);
      subs.push({
        id: s.id,
        patient: c.initials,
        monthly: c.deal.monthly,
        months: c.deal.months,
        status: s.status,
        nextBilling: s.nextBilling ? s.nextBilling.slice(0, 10) : null,
        lastPayment: s.lastPayment ? Number(s.lastPayment) : null,
      });
    } catch {
      subs.push({ id: c.subscriptionId, patient: c.initials, monthly: c.deal.monthly, months: c.deal.months, status: "UNKNOWN", nextBilling: null, lastPayment: null });
    }
  }

  // Sample (fictional) EMI plans so the desk is not empty: Ethan's plans (the same ones his app shows) and the clinic's
  // other patients. Real plans created through the app come first, with live PayPal status.
  const year = new Date().getFullYear();
  const sample: SubRow[] = [
    ...samplePlans("ethan").map((p) => ({
      id: `SAMPLE-${p.id.toUpperCase()}`,
      patient: "E.C.",
      monthly: p.monthly,
      months: p.months,
      status: "ACTIVE",
      nextBilling: p.nextDue,
      lastPayment: p.monthly,
    })),
    ...seededPlans.map((p, i) => {
      const next = new Date(`${p.nextPayment} ${year} 12:00`);
      return {
        id: `SAMPLE-${p.initials.replace(/\W/g, "")}-${i + 1}`,
        patient: p.initials,
        monthly: p.monthly,
        months: Math.ceil(p.balance / p.monthly) + 3,
        status: p.status === "Late" ? "SUSPENDED" : "ACTIVE",
        nextBilling: isNaN(next.getTime()) ? null : next.toISOString().slice(0, 10),
        lastPayment: p.monthly,
      };
    }),
  ];
  subs.push(...sample);

  return <BillingDesk data={data} subs={subs} error={error} />;
}
