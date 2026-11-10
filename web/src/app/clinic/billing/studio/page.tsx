import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { staffFromCookies } from "@/lib/staff";
import { logAudit } from "@/lib/audit-log";
import { getDashboardData } from "@/lib/dashboard-data";
import { withSample } from "@/lib/dashboard-sample";
import { StudioView } from "../studio-view";

export const metadata: Metadata = { title: "Billing analytics" };

export default async function StudioPage() {
  // Live PayPal data: render per request, not at build time.
  await connection();
  const staff = await staffFromCookies();
  if (!staff) redirect("/clinic/login");
  if (staff.role !== "admin") redirect("/clinic/billing");
  logAudit(staff, "opened billing analytics");
  let data;
  let error = "";
  try {
    data = withSample(await getDashboardData());
  } catch (e) {
    error = (e as Error).message;
  }
  return (
    <div className="dash">
      <header>
        <div>
          <h1>Billing analytics</h1>
          <div className="muted">AG Studio report over the clinic's PayPal business account (sandbox), with six months of fictional sample history added</div>
        </div>
        <Link className="btn sm ghost" href="/clinic/billing">Back to billing desk</Link>
      </header>
      {error ? <div className="err">Could not load PayPal data: {error}</div> : data && <StudioView data={data} licenseKey={process.env.AG_STUDIO} />}
    </div>
  );
}
