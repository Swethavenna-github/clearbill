"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef } from "ag-grid-community";

ModuleRegistry.registerModules([AllCommunityModule]);

type Plan = { initials: string; balance: number; monthly: number; nextPayment: string; status: "On track" | "Late" | "New"; ageDays: number; live?: boolean };
type Dash = {
  kpis: { billed: number; collected: number; outstanding: number; corrected: number };
  buckets: { label: string; amount: number }[];
  plans: Plan[];
  queue: { id: string; patient: string; billed: number; findings: { title: string; confidence: string; savings: number | null }[]; deal: { monthly: number; months: number } | null; status: string; invoiceNumber?: string }[];
  log: { case: string; from: string; message: string }[];
};
type Ask = { answer: string; rows: Plan[]; usedAI: boolean };

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const money = (p: { value?: number }) => (p.value === undefined ? "" : usd(p.value));
const theme = themeQuartz.withParams({ accentColor: "#6c4cf1", fontFamily: "inherit", headerFontWeight: 700, borderRadius: 10 });

const statusCell = (p: { value?: string }) => {
  const cls = (p.value || "").split(" ")[0];
  return <span className={`st ${cls}`}>{p.value}</span>;
};

export default function Clinic() {
  const [d, setD] = useState<Dash | null>(null);
  const [q, setQ] = useState("");
  const [ask, setAsk] = useState<Ask | null>(null);
  const [asking, setAsking] = useState(false);
  const [askErr, setAskErr] = useState("");

  const load = useCallback(() => {
    fetch("/api/clinic").then((r) => r.json()).then(setD).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load]);

  const approve = async (caseId: string) => {
    await fetch("/api/clinic", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caseId }) });
    load();
  };

  const submit = async (text: string) => {
    if (!text.trim()) return;
    setAsking(true);
    setAskErr("");
    try {
      const res = await fetch("/api/clinic/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: text }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not answer");
      setAsk(data);
    } catch (e) {
      setAskErr((e as Error).message);
    } finally {
      setAsking(false);
    }
  };

  const cols = useMemo<ColDef<Plan>[]>(
    () => [
      { field: "initials", headerName: "Patient", width: 110 },
      { field: "balance", headerName: "Balance", valueFormatter: money, width: 120, type: "rightAligned" },
      { field: "monthly", headerName: "Monthly", valueFormatter: money, width: 120, type: "rightAligned" },
      { field: "nextPayment", headerName: "Next payment", flex: 1, minWidth: 120 },
      { field: "ageDays", headerName: "Days unpaid", width: 130, type: "rightAligned" },
      { field: "status", headerName: "Status", cellRenderer: statusCell, width: 130 },
    ],
    [],
  );

  if (!d) return <div className="dash">Loading...</div>;
  const max = Math.max(1, ...d.buckets.map((b) => b.amount));
  const examples = ["Show late plans over $500", "Which plans have been unpaid the longest?", "Biggest balances on track"];

  return (
    <div className="dash">
      <header>
        <div>
          <h1>Riverbend Community Hospital</h1>
          <div className="muted">Billing dashboard · fictional clinic · updates live</div>
        </div>
        <span className="tag">Clearbill</span>
      </header>

      <div className="kpis">
        <div className="kpi"><span>Total billed</span><div>{usd(d.kpis.billed)}</div></div>
        <div className="kpi"><span>Collected</span><div>{usd(d.kpis.collected)}</div></div>
        <div className="kpi"><span>Outstanding</span><div>{usd(d.kpis.outstanding)}</div></div>
        <div className="kpi"><span>Corrected billing errors</span><div>{usd(d.kpis.corrected)}</div></div>
      </div>

      <div className="panel">
        <h2>Ask your data</h2>
        <form onSubmit={(e) => { e.preventDefault(); submit(q); }} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder='Try: "Show late plans over $500"' aria-label="Ask a question about the payment plans"
            style={{ flex: 1, minWidth: 220, padding: "11px 14px", borderRadius: 12, border: "1px solid var(--line)", fontSize: 15 }} />
          <button className="btn sm" disabled={asking} type="submit">{asking ? "Thinking..." : "Ask"}</button>
        </form>
        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {examples.map((x) => (
            <button key={x} className="btn sm ghost" style={{ fontSize: 13, padding: "6px 10px" }} onClick={() => { setQ(x); submit(x); }}>{x}</button>
          ))}
        </div>
        {askErr && <div className="err">{askErr}</div>}
        {ask && (
          <div style={{ marginTop: 12 }}>
            <div style={{ marginBottom: 8 }}>
              <b>{ask.answer}</b> <span className="pill" style={{ background: ask.usedAI ? "var(--purple)" : "var(--muted)" }}>{ask.usedAI ? "AI" : "keyword match"}</span>
            </div>
            {ask.rows.length > 0 && <AgGridReact<Plan> theme={theme} rowData={ask.rows} columnDefs={cols} domLayout="autoHeight" />}
          </div>
        )}
      </div>

      <div className="grid2">
        <div className="panel">
          <h2>Unpaid balances by age</h2>
          <div className="bars">
            {d.buckets.map((b) => (
              <div className="b" key={b.label}>
                <span>{b.label}</span>
                <div className="track"><div className="fill" style={{ width: `${(b.amount / max) * 100}%` }} /></div>
                <b>{usd(b.amount)}</b>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <h2>Bills flagged by patients</h2>
          {d.queue.length === 0 && <div className="muted">No flagged bills yet. Open a bill in the patient app and send an offer.</div>}
          {d.queue.map((c) => (
            <div className="qitem" key={c.id}>
              <div className="row">
                <b>{c.patient} · {usd(c.billed)}</b>
                <span className="st New">{c.status}</span>
              </div>
              <ul>
                {c.findings.map((f, i) => (
                  <li key={i}>{f.title}{f.savings ? ` (${usd(f.savings)})` : ""} <i className="muted">{f.confidence === "high" ? "looks wrong" : "needs review"}</i></li>
                ))}
              </ul>
              {c.deal && <div className="muted">Proposed plan: {usd(c.deal.monthly)} a month for {c.deal.months} months{c.invoiceNumber ? ` · invoice ${c.invoiceNumber}` : ""}</div>}
              {(c.status === "Flagged" || c.status === "Plan proposed") && c.deal && (
                <button className="btn sm" style={{ marginTop: 8 }} onClick={() => approve(c.id)}>Approve plan</button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <h2>Payment plans</h2>
        <AgGridReact<Plan> theme={theme} rowData={d.plans} columnDefs={cols} domLayout="autoHeight" getRowStyle={(p) => (p.data?.live ? { background: "#f3f0ff", fontWeight: 600 } : undefined)} />
        <div className="muted" style={{ marginTop: 8 }}>Patient names are shown as initials. The highlighted row comes from the live demo.</div>
      </div>

      <div className="panel">
        <h2>Agent conversation log</h2>
        {d.log.length === 0 && <div className="muted">Nothing yet.</div>}
        {d.log.map((l, i) => (
          <div className="logline" key={i}><b>{l.from === "patient" ? "Patient agent" : "Clinic agent"}</b> ({l.case}): {l.message}</div>
        ))}
      </div>
      <div className="muted" style={{ textAlign: "center" }}>Prototype with fictional data and PayPal sandbox.</div>
    </div>
  );
}
