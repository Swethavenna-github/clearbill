"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef } from "ag-grid-community";
import type { DashboardData } from "@/lib/dashboard-data";

ModuleRegistry.registerModules([AllCommunityModule]);

export type SubRow = { id: string; patient: string; monthly: number; months: number; status: string; nextBilling: string | null; lastPayment: number | null };

const theme = themeQuartz.withParams({ accentColor: "#6c4cf1", fontFamily: "inherit", headerFontWeight: 700, borderRadius: 10 });
const usd = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (p: { value?: number | null }) => (p.value === undefined || p.value === null ? "" : usd(p.value));
// Patient emails are shown masked by default: j***@example.com
const mask = (email: string | null) => (email ? email.replace(/^(.).*(@.*)$/, "$1***$2") : "");
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");

const pill = (color: string) => (p: { value?: string }) => <span className="st" style={{ background: color }}>{p.value}</span>;
const statusColor = (s: string) => (/paid|active|credit|completed|success/i.test(s) ? "#1a9d62" : /cancel|refund|fail|suspend|unknown/i.test(s) ? "#d7263d" : "#f08a24");
const human = (s: string) => ({ APPROVAL_PENDING: "Awaiting approval", ACTIVE: "Active", SUSPENDED: "Suspended", CANCELLED: "Cancelled", EXPIRED: "Completed" } as Record<string, string>)[s] || s;
const statusCell = (p: { value?: string }) => <span className="st" style={{ background: statusColor(p.value || "") }}>{human(p.value || "")}</span>;

export function BillingDesk({ data, subs, error }: { data: DashboardData | null; subs: SubRow[]; error: string }) {
  const invoices = data?.invoices ?? [];
  const customers = new Map((data?.customers ?? []).map((c) => [c.id, c]));
  const invoiceRows = invoices.map((i) => ({ ...i, customer: mask(customers.get(i.customerId)?.email ?? i.customerId) }));
  const transactions = (data?.transactions ?? []).map((t) => ({ ...t, counterparty: mask(t.counterparty) }));
  const balance = data?.balances?.[0];
  const received = transactions.filter((t) => t.direction === "Credit").reduce((s, t) => s + t.amount, 0);
  const openAmount = invoices.reduce((s, i) => s + i.outstanding, 0);
  const paidAmount = invoices.reduce((s, i) => s + i.netCollected, 0);
  const activeSubs = subs.filter((s) => s.status === "ACTIVE");
  const recurring = activeSubs.reduce((s, x) => s + x.monthly, 0);

  const invCols = useMemo<ColDef[]>(
    () => [
      { field: "number", headerName: "Invoice", width: 110 },
      { field: "customer", headerName: "Patient", flex: 1, minWidth: 140 },
      { field: "status", headerName: "Status", width: 130, cellRenderer: statusCell },
      { field: "total", headerName: "Total", width: 120, valueFormatter: money, type: "rightAligned" },
      { field: "paidAmount", headerName: "Paid", width: 120, valueFormatter: money, type: "rightAligned" },
      { field: "outstanding", headerName: "Outstanding", width: 130, valueFormatter: money, type: "rightAligned" },
      { field: "dueDate", headerName: "Due", width: 130, valueFormatter: (p) => day(p.value) },
    ],
    [],
  );
  const subCols = useMemo<ColDef[]>(
    () => [
      { field: "patient", headerName: "Patient", width: 110 },
      { field: "monthly", headerName: "Monthly (EMI)", width: 140, valueFormatter: money, type: "rightAligned" },
      { field: "months", headerName: "Months", width: 110, type: "rightAligned" },
      { field: "status", headerName: "PayPal status", width: 190, cellRenderer: statusCell },
      { field: "nextBilling", headerName: "Next payment", width: 150, valueFormatter: (p) => day(p.value) },
      { field: "lastPayment", headerName: "Last payment", width: 140, valueFormatter: money, type: "rightAligned" },
      { field: "id", headerName: "PayPal plan ID", flex: 1, minWidth: 160 },
    ],
    [],
  );
  const txCols = useMemo<ColDef[]>(
    () => [
      { field: "date", headerName: "Date", width: 150, valueFormatter: (p) => day(p.value) },
      { field: "eventType", headerName: "Type", flex: 1, minWidth: 140 },
      { field: "status", headerName: "Status", width: 130, cellRenderer: statusCell },
      { field: "counterparty", headerName: "From / to", width: 170 },
      { field: "amount", headerName: "Amount", width: 120, valueFormatter: money, type: "rightAligned" },
      { field: "fee", headerName: "Fee", width: 100, valueFormatter: money, type: "rightAligned" },
      { field: "net", headerName: "Net", width: 120, valueFormatter: money, type: "rightAligned" },
    ],
    [],
  );
  void pill;

  return (
    <div className="dash">
      <header>
        <div>
          <h1>Billing desk</h1>
          <div className="muted">Riverbend Community Hospital · PayPal business account (sandbox) · live from PayPal</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link className="btn sm ghost" href="/clinic">Back to dashboard</Link>
          <Link className="btn sm" href="/clinic/billing/studio">Open billing analytics (AG Studio)</Link>
        </div>
      </header>

      {error && <div className="err">Could not load PayPal data: {error}</div>}

      <div className="kpis">
        <div className="kpi"><span>PayPal balance (available)</span><div>{balance ? usd(balance.available) : "n/a"}</div></div>
        <div className="kpi"><span>Money received (last 31 days)</span><div>{usd(received)}</div></div>
        <div className="kpi"><span>Invoices outstanding</span><div>{usd(openAmount)}</div></div>
        <div className="kpi"><span>Active EMI plans · per month</span><div>{activeSubs.length} · {usd(recurring)}</div></div>
      </div>

      <div className="panel">
        <h2>EMI plans (monthly installments)</h2>
        {subs.length === 0 ? (
          <div className="muted">No plans yet. When a patient approves a plan in the patient app, it appears here with its live PayPal status.</div>
        ) : (
          <>
            <AgGridReact theme={theme} rowData={subs} columnDefs={subCols} domLayout="autoHeight" />
            <div className="muted" style={{ marginTop: 8 }}>Plans with an ID starting SAMPLE are fictional demo plans. Plans a patient approves in the app show up here with their real PayPal sandbox status. Suspended means a payment failed.</div>
          </>
        )}
      </div>

      <div className="panel">
        <h2>Invoices <span className="muted" style={{ fontWeight: 400 }}>· paid so far {usd(paidAmount)}</span></h2>
        {invoiceRows.length === 0 ? (
          <div className="muted">No invoices yet.</div>
        ) : (
          <AgGridReact theme={theme} rowData={invoiceRows} columnDefs={invCols} domLayout="autoHeight" pagination paginationPageSize={10} />
        )}
      </div>

      <div className="panel">
        <h2>Money received and fees</h2>
        {transactions.length === 0 ? (
          <div className="muted">
            No payments yet, or Transaction search is switched off for this PayPal app. Payments from patients (card or PayPal) will be listed here, with PayPal's fee and the net amount the clinic keeps.
          </div>
        ) : (
          <AgGridReact theme={theme} rowData={transactions} columnDefs={txCols} domLayout="autoHeight" pagination paginationPageSize={10} />
        )}
      </div>
      <div className="muted" style={{ textAlign: "center" }}>Sandbox data only. Patient emails are masked. Amounts are test money.</div>
    </div>
  );
}
