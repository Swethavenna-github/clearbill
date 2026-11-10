"use client";

import { ClinicStudio } from "./clinic-studio";
import { DashboardTab } from "./dashboard-tab";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef } from "ag-grid-community";

ModuleRegistry.registerModules([AllCommunityModule]);

type Role = "admin" | "frontdesk";
type Plan = { initials: string; plan?: string; balance: number; monthly: number; nextPayment: string; status: "On track" | "Late" | "New"; ageDays: number; live?: boolean };
type Dash = {
  kpis: { billed: number; collected: number; outstanding: number; corrected: number };
  buckets: { label: string; amount: number }[];
  plans: Plan[];
  queue: { id: string; patient: string; billed: number; findings: { title: string; confidence: string; savings: number | null }[]; deal: { monthly: number; months: number } | null; status: string; invoiceNumber?: string }[];
  log: { case: string; from: string; message: string }[];
};
type Ask = { answer: string; rows: Plan[]; usedAI: boolean };
type PatientRow = { id: string; name: string; phone: string; visitType: string; registeredAt: string; registeredBy: string; bills: number; balance: number | null };
type ReqRow = { id: string; name: string; phone: string; status: string; createdAt: string; decidedBy: string | null };
type Template = { id: string; title: string; total: number };
type AuditRow = { at: string; who: string; role: string; action: string; detail: string };
type Tab = "overview" | "dashboard" | "patients" | "requests" | "audit";

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const money = (p: { value?: number | null }) => (p.value === undefined || p.value === null ? "n/a" : usd(p.value));
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const theme = themeQuartz.withParams({ accentColor: "#6c4cf1", fontFamily: "inherit", headerFontWeight: 700, borderRadius: 10 });
const IDLE_MS = 10 * 60 * 1000;

const statusCell = (p: { value?: string }) => <span className={`st ${(p.value || "").split(" ")[0]}`}>{p.value}</span>;

async function call<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : undefined);
  if (res.status === 401) {
    window.location.href = "/clinic/login";
    throw new Error("Please sign in.");
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data as T;
}

export default function Clinic() {
  const [staff, setStaff] = useState<{ name: string; role: Role } | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);

  const signOut = useCallback(async () => {
    await fetch("/api/staff/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/clinic/login";
  }, []);

  useEffect(() => {
    call<{ staff: { name: string; role: Role } }>("/api/staff/me")
      .then((d) => {
        setStaff(d.staff);
        setTab(d.staff.role === "admin" ? "overview" : "patients");
      })
      .catch(() => {});
  }, []);

  // Automatic sign-out after 10 minutes without any click, key press or touch.
  useEffect(() => {
    if (!staff) return;
    const reset = () => {
      if (idle.current) clearTimeout(idle.current);
      idle.current = setTimeout(signOut, IDLE_MS);
    };
    reset();
    const events = ["click", "keydown", "touchstart", "mousemove"] as const;
    events.forEach((e) => window.addEventListener(e, reset));
    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      if (idle.current) clearTimeout(idle.current);
    };
  }, [staff, signOut]);

  if (!staff) return <div className="dash">Checking your sign-in...</div>;
  const admin = staff.role === "admin";
  const tabs: [Tab, string][] = admin
    ? [["overview", "Overview"], ["dashboard", "Dashboard"], ["patients", "Patients"], ["requests", "Pending requests"], ["audit", "Audit log"]]
    : [["patients", "Patients"], ["requests", "Pending requests"]];

  return (
    <div className="dash">
      <header>
        <div>
          <h1>Riverbend Community Hospital</h1>
          <div className="muted">Clinic dashboard · fictional clinic · signed in as {staff.name} ({admin ? "billing admin" : "front desk"})</div>
        </div>
        <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {admin && <a className="btn sm" href="/clinic/billing">Billing desk</a>}
          <button className="btn sm ghost" onClick={signOut}>Sign out</button>
          <span className="tag">Clearbill</span>
        </span>
      </header>

      <div className="ctabs" role="tablist">
        {tabs.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={`ctab ${tab === id ? "on" : ""}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === "overview" && admin && <Overview />}
      {tab === "dashboard" && admin && <DashboardTab />}
      {tab === "patients" && <Patients role={staff.role} />}
      {tab === "requests" && <Requests role={staff.role} />}
      {tab === "audit" && admin && <Audit />}

      <div className="muted" style={{ textAlign: "center", marginTop: 6 }}>Prototype with fictional data and PayPal sandbox. See COMPLIANCE.md for the privacy safeguards and their limits.</div>
    </div>
  );
}

/* ------------------------------- Overview ------------------------------- */

function Overview() {
  const [d, setD] = useState<Dash | null>(null);
  const [q, setQ] = useState("");
  const [ask, setAsk] = useState<Ask | null>(null);
  const [asking, setAsking] = useState(false);
  const [askErr, setAskErr] = useState("");

  const load = useCallback(() => {
    call<Dash>("/api/clinic").then(setD).catch(() => {});
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  const approve = async (caseId: string) => {
    await call("/api/clinic", { caseId });
    load();
  };
  const submit = async (text: string) => {
    if (!text.trim()) return;
    setAsking(true);
    setAskErr("");
    try {
      setAsk(await call<Ask>("/api/clinic/ask", { question: text }));
    } catch (e) {
      setAskErr((e as Error).message);
    } finally {
      setAsking(false);
    }
  };

  const cols = useMemo<ColDef<Plan>[]>(
    () => [
      { field: "initials", headerName: "Patient", width: 100 },
      { field: "plan", headerName: "Plan", flex: 1, minWidth: 170 },
      { field: "balance", headerName: "Balance", valueFormatter: money, width: 120, type: "rightAligned" },
      { field: "monthly", headerName: "Monthly", valueFormatter: money, width: 120, type: "rightAligned" },
      { field: "nextPayment", headerName: "Next payment", flex: 1, minWidth: 120 },
      { field: "ageDays", headerName: "Days past due", width: 140, type: "rightAligned" },
      { field: "status", headerName: "Status", cellRenderer: statusCell, width: 130 },
    ],
    [],
  );

  if (!d) return <div className="muted">Loading...</div>;
  const examples = ["Show late plans over $500", "Which plans are most overdue?", "Biggest balances on track"];

  return (
    <>
      <div className="kpis">
        <div className="kpi"><span>Total billed</span><div>{usd(d.kpis.billed)}</div></div>
        <div className="kpi"><span>Collected</span><div>{usd(d.kpis.collected)}</div></div>
        <div className="kpi"><span>Outstanding</span><div>{usd(d.kpis.outstanding)}</div></div>
        <div className="kpi"><span>Corrected billing errors</span><div>{usd(d.kpis.corrected)}</div></div>
      </div>

      <div className="panel">
        <h2>Ask your data</h2>
        <form onSubmit={(e) => { e.preventDefault(); submit(q); }} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder='Try: "Show late plans over $500"' aria-label="Ask a question about the payment plans" style={{ flex: 1, minWidth: 220, padding: "11px 14px", borderRadius: 12, border: "1px solid var(--line)", fontSize: 15 }} />
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
            <div style={{ marginBottom: 8 }}><b>{ask.answer}</b> <span className="pill" style={{ background: ask.usedAI ? "var(--purple)" : "var(--muted)" }}>{ask.usedAI ? "AI" : "keyword match"}</span></div>
            {ask.rows.length > 0 && <AgGridReact<Plan> theme={theme} rowData={ask.rows} columnDefs={cols} domLayout="autoHeight" />}
          </div>
        )}
      </div>

      <div className="panel" style={{ minWidth: 0, marginBottom: 14 }}>
        <ClinicStudio buckets={d.buckets} />
      </div>

      <div className="grid2">
        <div className="panel">
          <h2>Bills flagged by patients</h2>
          {d.queue.length === 0 && <div className="muted">No flagged bills yet. Open a bill in the patient app and send an offer.</div>}
          {d.queue.map((c) => (
            <div className="qitem" key={c.id}>
              <div className="row">
                <b>{c.patient.split(" ")[0]} {c.patient.split(" ").slice(-1)[0][0]}. · {usd(c.billed)}</b>
                <span className="st New">{c.status}</span>
              </div>
              <ul>
                {c.findings.map((f, i) => (
                  <li key={i}>{f.title}{f.savings ? ` (${usd(f.savings)})` : ""} <i className="muted">{f.confidence === "high" ? "looks wrong" : "needs review"}</i></li>
                ))}
              </ul>
              {c.deal && <div className="muted">Proposed plan: {usd(c.deal.monthly)} a month for {c.deal.months} months{c.invoiceNumber ? ` · invoice ${c.invoiceNumber}` : ""}</div>}
              {(c.status === "Flagged" || c.status === "Plan proposed") && c.deal && <button className="btn sm" style={{ marginTop: 8 }} onClick={() => approve(c.id)}>Approve plan</button>}
            </div>
          ))}
        </div>
        <div className="panel">
          <h2>Agent conversation log</h2>
          {d.log.length === 0 && <div className="muted">Nothing yet.</div>}
          {d.log.map((l, i) => (
            <div className="logline" key={i}><span className="muted">{l.case}</span> · <b>{l.from === "patient" ? "Patient agent" : "Clinic agent"}</b>: {l.message}</div>
          ))}
        </div>
      </div>

      <div className="panel">
        <h2>Payment plans</h2>
        <AgGridReact<Plan> theme={theme} rowData={d.plans} columnDefs={cols} domLayout="autoHeight" getRowStyle={(p) => (p.data?.live ? { background: "#f3f0ff", fontWeight: 600 } : undefined)} />
        <div className="muted" style={{ marginTop: 8 }}>Patients are shown by initials. The highlighted row is the new plan from the live demo. Ethan's other plans are the same ones his app shows.</div>
      </div>

    </>
  );
}

/* ------------------------------- Patients ------------------------------- */

function Patients({ role }: { role: Role }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<PatientRow[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [revealed, setRevealed] = useState<{ name: string; phone: string } | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", visitType: "Outpatient", templateBillId: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback((query: string) => {
    call<{ patients: PatientRow[]; templates: Template[] }>(`/api/staff/patients?q=${encodeURIComponent(query)}`)
      .then((d) => {
        setRows(d.patients);
        setTemplates(d.templates);
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    const t = setTimeout(() => load(q), 250);
    return () => clearTimeout(t);
  }, [q, load]);

  const reveal = useCallback(async (id: string) => {
    try {
      setRevealed(await call<{ name: string; phone: string }>("/api/staff/patients/reveal", { id }));
    } catch {
      /* ignore */
    }
  }, []);

  const register = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await call<{ patient: { name: string; phone: string } }>("/api/staff/patients", form);
      setMsg({ ok: true, text: `Registered ${r.patient.name} (${r.patient.phone}). They can now sign in to the app with that number.` });
      setForm({ name: "", phone: "", visitType: "Outpatient", templateBillId: "" });
      load(q);
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const cols = useMemo<ColDef<PatientRow>[]>(
    () => [
      { field: "name", headerName: "Patient", width: 150 },
      { field: "phone", headerName: "Phone", width: 160 },
      { field: "visitType", headerName: "Visit type", width: 130 },
      { field: "registeredAt", headerName: "Registered", width: 150, valueFormatter: (p) => (p.value ? when(p.value) : "") },
      { field: "registeredBy", headerName: "By", width: 130 },
      { field: "bills", headerName: "Bills", width: 90, type: "rightAligned" },
      ...(role === "admin" ? [{ field: "balance", headerName: "Billed", width: 120, valueFormatter: money, type: "rightAligned" } as ColDef<PatientRow>] : []),
      { headerName: "", width: 140, sortable: false, cellRenderer: (p: { data?: PatientRow; context: { reveal: (id: string) => void } }) => (p.data ? <button className="btn sm ghost" style={{ padding: "3px 10px", fontSize: 12 }} onClick={() => p.context.reveal(p.data!.id)}>Show details</button> : null) },
    ],
    [role],
  );

  return (
    <>
      <div className="panel">
        <h2>Register a patient</h2>
        <div className="muted" style={{ marginBottom: 8 }}>Once registered, the patient can sign in to the Clearbill app with this phone number and see their bills. Use fictional people only.</div>
        {msg && <div className={msg.ok ? "ok" : "err"}>{msg.text}</div>}
        <div className="regform">
          <label className="field">Full name<input className="inp" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Priya Raman" maxLength={60} /></label>
          <label className="field">Mobile (US, +1)<input className="inp" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/[^\d\s()-]/g, "") })} placeholder="e.g. 555 010 2000" maxLength={16} /></label>
          <label className="field">Visit type
            <select className="inp" value={form.visitType} onChange={(e) => setForm({ ...form, visitType: e.target.value })}>
              <option>Outpatient</option><option>Inpatient</option><option>Emergency</option>
            </select>
          </label>
          <label className="field">Attach a sample bill (optional)
            <select className="inp" value={form.templateBillId} onChange={(e) => setForm({ ...form, templateBillId: e.target.value })}>
              <option value="">No bill yet</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.title} ({usd(t.total)})</option>)}
            </select>
          </label>
        </div>
        <button className="btn sm" disabled={busy} onClick={register}>{busy ? "Registering..." : "Register patient"}</button>
      </div>

      <div className="panel">
        <div className="row" style={{ alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>Patients</h2>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or phone digits" aria-label="Search patients" style={{ flex: 1, minWidth: 220, maxWidth: 360, padding: "9px 12px", borderRadius: 12, border: "1px solid var(--line)", fontSize: 14 }} />
        </div>
        {revealed && (
          <div className="notice">
            <b>Full details (this view is recorded in the audit log):</b> {revealed.name} · {revealed.phone}{" "}
            <button className="btn sm ghost" style={{ padding: "2px 8px", fontSize: 12 }} onClick={() => setRevealed(null)}>Hide</button>
          </div>
        )}
        <AgGridReact<PatientRow> theme={theme} rowData={rows} columnDefs={cols} context={{ reveal }} domLayout="autoHeight" autoSizeStrategy={{ type: "fitGridWidth" }} />
        <div className="muted" style={{ marginTop: 8 }}>Names and numbers are masked in this list. Searching works on the full data, but the log records only that a search happened. {role === "frontdesk" ? "Front desk accounts do not see amounts." : ""}</div>
      </div>
    </>
  );
}

/* -------------------------------- Requests ------------------------------- */

function Requests({ role }: { role: Role }) {
  const [reqs, setReqs] = useState<ReqRow[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [attach, setAttach] = useState("");
  const [plans, setPlans] = useState<Dash["queue"]>([]);
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    call<{ requests: ReqRow[]; templates: Template[] }>("/api/staff/requests").then((d) => { setReqs(d.requests); setTemplates(d.templates); }).catch(() => {});
    if (role === "admin") call<Dash>("/api/clinic").then((d) => setPlans(d.queue.filter((c) => c.status === "Plan proposed" || c.status === "Flagged"))).catch(() => {});
  }, [role]);
  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  const decide = async (id: string, decision: "approved" | "declined") => {
    setMsg("");
    try {
      await call("/api/staff/requests", { id, decision, templateBillId: attach || undefined });
      setMsg(decision === "approved" ? "Approved. The patient can now sign in with that number." : "Declined.");
      load();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };
  const approvePlan = async (caseId: string) => {
    await call("/api/clinic", { caseId });
    load();
  };

  const pending = reqs.filter((r) => r.status === "pending");
  const done = reqs.filter((r) => r.status !== "pending");

  return (
    <>
      <div className="panel">
        <h2>Registration requests <span className="muted" style={{ fontWeight: 400 }}>· {pending.length} waiting</span></h2>
        <div className="muted" style={{ marginBottom: 8 }}>People who typed their number in the Clearbill app and asked this clinic to register them. Approve only people you can verify at the front desk.</div>
        {msg && <div className="ok">{msg}</div>}
        {pending.length > 0 && (
          <label className="field" style={{ maxWidth: 420 }}>When approving, attach a sample bill (optional)
            <select className="inp" value={attach} onChange={(e) => setAttach(e.target.value)}>
              <option value="">No bill</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.title} ({usd(t.total)})</option>)}
            </select>
          </label>
        )}
        {pending.length === 0 && <div className="muted">No requests waiting. In the patient app, enter a number the clinic has not registered and tap "Ask the clinic to register me".</div>}
        {pending.map((r) => (
          <div className="qitem" key={r.id}>
            <div className="row" style={{ alignItems: "center" }}>
              <div><b>{r.name}</b> <span className="muted">· {r.phone} · {when(r.createdAt)}</span></div>
              <span style={{ display: "flex", gap: 8 }}>
                <button className="btn sm" onClick={() => decide(r.id, "approved")}>Approve</button>
                <button className="btn sm ghost" onClick={() => decide(r.id, "declined")}>Decline</button>
              </span>
            </div>
          </div>
        ))}
      </div>

      {role === "admin" && (
        <div className="panel">
          <h2>Payment plans awaiting approval <span className="muted" style={{ fontWeight: 400 }}>· {plans.length}</span></h2>
          {plans.length === 0 && <div className="muted">None right now.</div>}
          {plans.map((c) => (
            <div className="qitem" key={c.id}>
              <div className="row" style={{ alignItems: "center" }}>
                <div><b>{c.patient.split(" ")[0]} {c.patient.split(" ").slice(-1)[0][0]}.</b> <span className="muted">· {c.deal ? `${usd(c.deal.monthly)} a month for ${c.deal.months} months` : "no plan yet"} · {c.findings.length} flagged items</span></div>
                {c.deal && <button className="btn sm" onClick={() => approvePlan(c.id)}>Approve plan</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {done.length > 0 && (
        <div className="panel">
          <h2>Handled requests</h2>
          {done.map((r) => (
            <div className="logline" key={r.id}><b>{r.name}</b> ({r.phone}): {r.status} by {r.decidedBy}</div>
          ))}
        </div>
      )}
    </>
  );
}

/* --------------------------------- Audit --------------------------------- */

function Audit() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const load = useCallback(() => {
    call<{ entries: AuditRow[] }>("/api/staff/audit").then((d) => setRows(d.entries)).catch(() => {});
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const cols = useMemo<ColDef<AuditRow>[]>(
    () => [
      { field: "at", headerName: "When", width: 170, valueFormatter: (p) => (p.value ? when(p.value) : "") },
      { field: "who", headerName: "Who", width: 140 },
      { field: "role", headerName: "Role", width: 120 },
      { field: "action", headerName: "Action", flex: 1, minWidth: 240 },
      { field: "detail", headerName: "Detail (no patient data)", width: 220 },
    ],
    [],
  );
  return (
    <div className="panel">
      <div className="row" style={{ alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Audit log</h2>
        <button className="btn sm ghost" onClick={load}>Refresh</button>
      </div>
      <div className="muted" style={{ margin: "6px 0 10px" }}>Every sign-in, search, registration, reveal and approval is recorded here with who did it. Entries never contain names, phone numbers or search text. Only billing admins can read this log.</div>
      <AgGridReact<AuditRow> theme={theme} rowData={rows} columnDefs={cols} domLayout="autoHeight" pagination paginationPageSize={15} />
    </div>
  );
}

