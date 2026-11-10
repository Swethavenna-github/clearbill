"use client";

// The Dashboard tab: one AG Studio report (the sponsor's dashboard tool) over everything the clinic site knows.
// Three pages: Money, Patients and requests, Care and activity. Patients appear by initials only and no phone
// numbers are passed to Studio. The monthly trend is fictional sample data; the rest is the live demo data.
import { useCallback, useEffect, useRef, useState } from "react";
import { AgStudio, AgStudioProvider } from "ag-studio-react";
import type { AgDataSourcesDefinition, AgReportState } from "ag-studio";
import { agStudioPayPalTheme } from "./billing/studio/theme";

type Dash = {
  kpis: { billed: number; collected: number; outstanding: number; corrected: number };
  buckets: { label: string; amount: number }[];
  plans: { initials: string; plan?: string; balance: number; monthly: number; nextPayment: string; status: string; ageDays: number }[];
  queue: { id: string; patient: string; billed: number; findings: { title: string; savings: number | null }[]; deal: { monthly: number; months: number } | null; status: string }[];
  log: { case: string; from: string; message: string }[];
};
type PatientRow = { id: string; name: string; visitType: string; registeredAt: string; registeredBy: string; bills: number; balance: number | null };
type ReqRow = { id: string; status: string; createdAt: string; decidedBy: string | null };
type AuditRow = { at: string; who: string; role: string; action: string };

const TREND = [
  { month: "Jun", order: 1, billed: 6200, collected: 3100 },
  { month: "Jul", order: 2, billed: 7400, collected: 4300 },
  { month: "Aug", order: 3, billed: 8100, collected: 5600 },
  { month: "Sep", order: 4, billed: 9300, collected: 6900 },
  { month: "Oct", order: 5, billed: 10200, collected: 8400 },
  { month: "Nov", order: 6, billed: 11100, collected: 9700 },
];

const initialsOf = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((p, i, a) => (i === 0 ? p : p[0] + "."))
    .join(" ");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthOf = (iso: string) => MONTHS[Number(iso.slice(5, 7)) - 1] ?? iso.slice(0, 7);

// --- report -------------------------------------------------------------------------

const FONT = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const typo = (fontSize: number, fontWeight: "normal" | "bold" = "normal") => ({ fontFamily: FONT, fontSize, fontWeight, fontStyle: "normal" as const });
const title = (text: string) => ({ title: { enabled: true, text } });
const sum = (id: string) => ({ id, aggregation: "sum" as const });
const countd = (id: string) => ({ id, aggregation: "countd" as const });
const at = (xTrack: number, yTrack: number, xSpan: number, ySpan: number) => ({ xTrack, yTrack, xSpan, ySpan });
const legend = { style: { theme: { common: { legend: { enabled: true } } } } };

const kpi = (text: string, value: { id: string; aggregation: "sum" | "countd" }) => ({
  type: "value" as const,
  dataMapping: { value: [value] },
  format: {
    title: { enabled: true, text, typography: typo(14, "bold") },
    caption: { enabled: true, text: "", typography: typo(0) },
    style: { typography: typo(26) },
  },
});

const report = {
  selectedPageId: "money",
  pages: [
    {
      id: "money",
      name: "Money",
      widgets: {
        "k-billed": kpi("Billed", sum("kpis.billed")),
        "k-collected": kpi("Collected", sum("kpis.collected")),
        "k-outstanding": kpi("Outstanding", sum("kpis.outstanding")),
        "k-corrected": kpi("Corrected by AI review", sum("kpis.corrected")),
        aging: {
          type: "bar-chart-grouped",
          dataMapping: { categoryKey: [{ id: "aging.label" }], valueKey: [sum("aging.amount")] },
          format: title("Unpaid balances by days past due"),
        },
        trend: {
          type: "line-chart",
          dataMapping: { categoryKey: [{ id: "trend.month" }], valueKey: [sum("trend.billed"), sum("trend.collected")] },
          format: { ...title("Billed vs collected, last 6 months (sample data)"), ...legend },
        },
        "plan-status": {
          type: "donut-chart",
          dataMapping: { categoryKey: [{ id: "plans.status" }], valueKey: [sum("plans.balance")] },
          format: { ...title("Plan balance by status"), style: { custom: { pieDataLabel: { enabled: true }, totalLabel: { enabled: false } } } },
        },
        "plan-balance": {
          type: "column-chart-grouped",
          dataMapping: { categoryKey: [{ id: "plans.who" }], valueKey: [sum("plans.balance"), sum("plans.monthly")] },
          format: { ...title("Balance and monthly payment by plan"), ...legend },
        },
        plans: {
          type: "grid",
          dataMapping: {
            cols: [{ id: "plans.initials" }, { id: "plans.plan" }, { id: "plans.status" }, sum("plans.balance"), sum("plans.monthly"), sum("plans.ageDays")],
          },
          sort: [{ field: sum("plans.balance"), direction: "desc" }],
          format: title("Payment plans (days past due in the last column)"),
        },
      },
      widgetLayout: {
        "k-billed": at(0, 0, 6, 6),
        "k-collected": at(6, 0, 6, 6),
        "k-outstanding": at(12, 0, 6, 6),
        "k-corrected": at(18, 0, 6, 6),
        aging: at(0, 6, 12, 17),
        trend: at(12, 6, 12, 17),
        "plan-status": at(0, 23, 8, 17),
        "plan-balance": at(8, 23, 16, 17),
        plans: at(0, 40, 24, 18),
      },
    },
    {
      id: "patients",
      name: "Patients and requests",
      widgets: {
        "k-patients": kpi("Registered patients", countd("patients.id")),
        "k-requests": kpi("Registration requests", countd("requests.id")),
        "k-pending": kpi("Waiting for approval", { id: "requests.isPending", aggregation: "sum" }),
        "k-billed-pat": kpi("Bills on file", sum("patients.bills")),
        visit: {
          type: "donut-chart",
          dataMapping: { categoryKey: [{ id: "patients.visitType" }], valueKey: [countd("patients.id")] },
          format: { ...title("Patients by visit type"), style: { custom: { pieDataLabel: { enabled: true }, totalLabel: { enabled: false } } } },
        },
        "reg-month": {
          type: "column-chart-grouped",
          dataMapping: { categoryKey: [{ id: "patients.month" }], valueKey: [countd("patients.id")] },
          format: title("Patients registered by month"),
        },
        "reg-by": {
          type: "bar-chart-grouped",
          dataMapping: { categoryKey: [{ id: "patients.registeredBy" }], valueKey: [countd("patients.id")] },
          format: title("Registered by staff member"),
        },
        "req-status": {
          type: "donut-chart",
          dataMapping: { categoryKey: [{ id: "requests.status" }], valueKey: [countd("requests.id")] },
          format: { ...title("Registration requests by status"), style: { custom: { pieDataLabel: { enabled: true }, totalLabel: { enabled: false } } } },
        },
        patients: {
          type: "grid",
          dataMapping: { cols: [{ id: "patients.name" }, { id: "patients.visitType" }, { id: "patients.month" }, { id: "patients.registeredBy" }, sum("patients.bills"), sum("patients.balance")] },
          sort: [{ field: sum("patients.balance"), direction: "desc" }],
          format: title("Patients (names shortened, no phone numbers)"),
        },
      },
      widgetLayout: {
        "k-patients": at(0, 0, 6, 6),
        "k-requests": at(6, 0, 6, 6),
        "k-pending": at(12, 0, 6, 6),
        "k-billed-pat": at(18, 0, 6, 6),
        visit: at(0, 6, 8, 17),
        "reg-month": at(8, 6, 8, 17),
        "req-status": at(16, 6, 8, 17),
        "reg-by": at(0, 23, 8, 17),
        patients: at(8, 23, 16, 17),
      },
    },
    {
      id: "care",
      name: "Care and activity",
      widgets: {
        "k-flagged": kpi("Bills flagged by patients", countd("queue.id")),
        "k-flags": kpi("Possible billing mistakes", sum("queue.flags")),
        "k-saving": kpi("Possible savings", sum("queue.savings")),
        "k-audit": kpi("Staff actions logged", countd("audit.id")),
        "queue-status": {
          type: "donut-chart",
          dataMapping: { categoryKey: [{ id: "queue.status" }], valueKey: [countd("queue.id")] },
          format: { ...title("Flagged bills by status"), style: { custom: { pieDataLabel: { enabled: true }, totalLabel: { enabled: false } } } },
        },
        "queue-money": {
          type: "column-chart-grouped",
          dataMapping: { categoryKey: [{ id: "queue.patient" }], valueKey: [sum("queue.billed"), sum("queue.savings")] },
          format: { ...title("Billed vs possible savings, by patient"), ...legend },
        },
        "audit-action": {
          type: "bar-chart-grouped",
          dataMapping: { categoryKey: [{ id: "audit.action" }], valueKey: [countd("audit.id")] },
          format: title("Staff actions by type"),
        },
        "audit-who": {
          type: "donut-chart",
          dataMapping: { categoryKey: [{ id: "audit.who" }], valueKey: [countd("audit.id")] },
          format: { ...title("Staff actions by person"), style: { custom: { pieDataLabel: { enabled: true }, totalLabel: { enabled: false } } } },
        },
        queue: {
          type: "grid",
          dataMapping: { cols: [{ id: "queue.patient" }, { id: "queue.status" }, sum("queue.billed"), sum("queue.flags"), sum("queue.savings"), sum("queue.monthly"), sum("queue.months")] },
          sort: [{ field: sum("queue.billed"), direction: "desc" }],
          format: title("Flagged bills and proposed plans"),
        },
      },
      widgetLayout: {
        "k-flagged": at(0, 0, 6, 6),
        "k-flags": at(6, 0, 6, 6),
        "k-saving": at(12, 0, 6, 6),
        "k-audit": at(18, 0, 6, 6),
        "queue-status": at(0, 6, 8, 17),
        "queue-money": at(8, 6, 16, 17),
        "audit-action": at(0, 23, 14, 17),
        "audit-who": at(14, 23, 10, 17),
        queue: at(0, 40, 24, 16),
      },
    },
  ],
} as unknown as AgReportState;

// --- data ---------------------------------------------------------------------------

function buildData(d: Dash, patients: PatientRow[], reqs: ReqRow[], audit: AuditRow[]): AgDataSourcesDefinition {
  const queue = d.queue.map((c) => ({
    id: c.id,
    patient: initialsOf(c.patient),
    status: c.status,
    billed: c.billed,
    flags: c.findings.length,
    savings: c.findings.reduce((t, f) => t + (f.savings ?? 0), 0),
    monthly: c.deal?.monthly ?? 0,
    months: c.deal?.months ?? 0,
  }));
  return {
    description: "A clinic's billing, payment plans, patients, registration requests and staff activity. All people are fictional; patients are shown by shortened name only.",
    sources: [
      { id: "kpis", name: "Totals", data: [d.kpis], fields: [
        { id: "billed", name: "Billed", format: "currencyFormat" },
        { id: "collected", name: "Collected", format: "currencyFormat" },
        { id: "outstanding", name: "Outstanding", format: "currencyFormat" },
        { id: "corrected", name: "Corrected", format: "currencyFormat" },
      ] },
      { id: "aging", name: "Unpaid balances", data: d.buckets.map((b, i) => ({ label: b.label, order: i + 1, amount: b.amount })), fields: [
        { id: "label", name: "Days past due", format: "textFormat" },
        { id: "order", name: "Order", format: "integerFormat", hide: true },
        { id: "amount", name: "Unpaid balance", format: "currencyFormat" },
      ] },
      { id: "trend", name: "Monthly trend", data: TREND, fields: [
        { id: "month", name: "Month", format: "textFormat" },
        { id: "order", name: "Order", format: "integerFormat", hide: true },
        { id: "billed", name: "Billed", format: "currencyFormat" },
        { id: "collected", name: "Collected", format: "currencyFormat" },
      ] },
      { id: "plans", name: "Payment plans", data: d.plans.map((p, i) => ({ id: String(i), initials: p.initials, plan: p.plan ?? "Plan", who: `${p.initials} ${p.plan ?? ""}`.trim(), status: p.status, balance: p.balance, monthly: p.monthly, ageDays: p.ageDays })), fields: [
        { id: "id", name: "ID", format: "textFormat", hide: true },
        { id: "initials", name: "Patient", format: "textFormat" },
        { id: "plan", name: "Plan", format: "textFormat" },
        { id: "who", name: "Patient and plan", format: "textFormat" },
        { id: "status", name: "Status", format: "textFormat" },
        { id: "balance", name: "Balance", format: "currencyFormat" },
        { id: "monthly", name: "Monthly", format: "currencyFormat" },
        { id: "ageDays", name: "Days past due", format: "integerFormat" },
      ] },
      { id: "patients", name: "Patients", data: patients.map((p) => ({ id: p.id, name: p.name, visitType: p.visitType, month: monthOf(p.registeredAt), registeredBy: p.registeredBy, bills: p.bills, balance: p.balance ?? 0 })), fields: [
        { id: "id", name: "ID", format: "textFormat", hide: true },
        { id: "name", name: "Patient", format: "textFormat" },
        { id: "visitType", name: "Visit type", format: "textFormat" },
        { id: "month", name: "Registered", format: "textFormat" },
        { id: "registeredBy", name: "Registered by", format: "textFormat" },
        { id: "bills", name: "Bills", format: "integerFormat" },
        { id: "balance", name: "Billed", format: "currencyFormat" },
      ] },
      { id: "requests", name: "Registration requests", data: reqs.map((r) => ({ id: r.id, status: r.status[0].toUpperCase() + r.status.slice(1), isPending: r.status === "pending" ? 1 : 0 })), fields: [
        { id: "id", name: "ID", format: "textFormat", hide: true },
        { id: "status", name: "Status", format: "textFormat" },
        { id: "isPending", name: "Waiting", format: "integerFormat" },
      ] },
      { id: "queue", name: "Flagged bills", data: queue, fields: [
        { id: "id", name: "ID", format: "textFormat", hide: true },
        { id: "patient", name: "Patient", format: "textFormat" },
        { id: "status", name: "Status", format: "textFormat" },
        { id: "billed", name: "Billed", format: "currencyFormat" },
        { id: "flags", name: "Flags", format: "integerFormat" },
        { id: "savings", name: "Possible savings", format: "currencyFormat" },
        { id: "monthly", name: "Proposed monthly", format: "currencyFormat" },
        { id: "months", name: "Months", format: "integerFormat" },
      ] },
      { id: "audit", name: "Staff activity", data: audit.map((a, i) => ({ id: String(i), action: a.action, who: a.who })), fields: [
        { id: "id", name: "ID", format: "textFormat", hide: true },
        { id: "action", name: "Action", format: "textFormat" },
        { id: "who", name: "Staff member", format: "textFormat" },
      ] },
    ],
  } as unknown as AgDataSourcesDefinition;
}

// --- component ----------------------------------------------------------------------

async function get<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

export function DashboardTab() {
  const [data, setData] = useState<AgDataSourcesDefinition | null>(null);
  const [err, setErr] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState("money");

  const load = useCallback(async () => {
    try {
      const [d, p, r, a] = await Promise.all([
        get<Dash>("/api/clinic"),
        get<{ patients: PatientRow[] }>("/api/staff/patients"),
        get<{ requests: ReqRow[] }>("/api/staff/requests"),
        get<{ entries: AuditRow[] }>("/api/staff/audit"),
      ]);
      setData(buildData(d, p.patients, r.requests, a.entries));
      setErr("");
    } catch {
      setErr("Could not load the dashboard data. Try again.");
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  if (err) return <div className="panel"><div className="err">{err}</div> <button className="btn sm" onClick={load}>Retry</button></div>;
  if (!data) return <div className="panel muted">Loading dashboard...</div>;
  return (
    <div className="panel" style={{ padding: 8 }}>
      <div className="row" style={{ alignItems: "center", padding: "4px 8px" }}>
        <span className="ctabs" role="tablist" style={{ margin: 0, border: 0 }}>
          {[["money", "Money"], ["patients", "Patients and requests"], ["care", "Care and activity"]].map(([id, label]) => (
            <button key={id} role="tab" aria-selected={page === id} className={`ctab ${page === id ? "on" : ""}`} onClick={() => setPage(id)}>{label}</button>
          ))}
        </span>
        <span style={{ display: "flex", gap: 8, alignItems: "center" }}><span className="muted">Built with AG Studio</span><button className="btn sm ghost" onClick={load}>Refresh</button></span>
      </div>
      <div ref={box} className="cb-studio" style={{ height: "calc(100vh - 230px)", minHeight: 560, minWidth: 0, position: "relative" }}>
        <AgStudioProvider>
          <AgStudio key={page} style={{ height: "100%", width: "100%" }} theme={agStudioPayPalTheme} layout={{ widgetBorderEnabled: true }} data={data} initialState={{ ...report, selectedPageId: page } as AgReportState} mode="view" panels={{ view: { left: [], right: [] } }} />
        </AgStudioProvider>
      </div>
    </div>
  );
}
