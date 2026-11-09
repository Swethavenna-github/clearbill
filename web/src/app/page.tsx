"use client";

import { useEffect, useState } from "react";

type BillRow = { id: string; title: string; patient: string; total: number };
type AuditResp = {
  bill: {
    bill_id: string;
    patient: { name: string; age: number; occupation: string; insurance: string };
    provider: { name: string };
    date_of_service: string;
    discharge_date?: string;
    total_charges: number;
    insurance: { note: string; paid: number };
    bill_notes: string;
  };
  lines: { line: number; description: string; charge: number; quantity: number; plain: string }[];
  findings: { id: string; title: string; confidence: "high" | "medium"; explain: string; fix: string; savings: number | null; source?: string }[];
  correctedCharges: number;
  estimatedShare: { amount: number; basis: string };
  ai: { summary: string; questions: string[] } | null;
  aiEnabled: boolean;
};
type Round = { from: "patient" | "clinic"; monthly: number; months: number; message: string };
type NegResp = { target: number; rounds: Round[]; deal: { monthly: number; months: number; lastPayment: number; total: number; outcome: string }; rules: { min_monthly: number } };

const usd = (n: number, d = 0) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const STEPS = ["home", "bill", "check", "budget", "agents", "pay", "done"] as const;
type Step = (typeof STEPS)[number];

async function api<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : undefined);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data as T;
}

export default function Patient() {
  const [step, setStep] = useState<Step>("home");
  const [bills, setBills] = useState<BillRow[]>([]);
  const [audit, setAudit] = useState<AuditResp | null>(null);
  const [budget, setBudget] = useState(200);
  const [neg, setNeg] = useState<NegResp | null>(null);
  const [shown, setShown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [invoice, setInvoice] = useState<{ number: string; viewUrl: string | null; qrBase64: string | null } | null>(null);
  const [approveUrl, setApproveUrl] = useState<string | null>(null);
  const [subStatus, setSubStatus] = useState("");
  const [billId, setBillId] = useState("");

  useEffect(() => {
    api<{ bills: BillRow[] }>("/api/audit").then((d) => setBills(d.bills)).catch(() => {});
    const q = new URLSearchParams(window.location.search);
    if (q.get("paid") && q.get("bill")) {
      setBillId(q.get("bill")!);
      setStep("done");
      fetch(`/api/paypal/status?bill=${q.get("bill")}&subscription_id=${q.get("subscription_id") || ""}`)
        .then((r) => r.json())
        .then((d) => setSubStatus(d.subscription?.status || d.error || ""));
    }
  }, []);

  useEffect(() => {
    if (step === "agents" && neg && shown < neg.rounds.length) {
      const t = setTimeout(() => setShown((s) => s + 1), 1300);
      return () => clearTimeout(t);
    }
  }, [step, neg, shown]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const pick = (id: string) =>
    run(async () => {
      const d = await api<AuditResp>("/api/audit", { billId: id });
      setAudit(d);
      setBillId(id);
      setNeg(null);
      setInvoice(null);
      setApproveUrl(null);
      setBudget(id === "B09" ? 200 : 150);
      setStep("bill");
    });

  const send = () =>
    run(async () => {
      const d = await api<NegResp>("/api/negotiate", { billId, budget });
      setNeg(d);
      setShown(0);
      setStep("agents");
    });

  const startPaypal = () =>
    run(async () => {
      if (!neg) return;
      const inv = await api<{ invoice: { number: string; viewUrl: string | null; qrBase64: string | null } }>("/api/paypal/invoice", { billId });
      setInvoice(inv.invoice);
      const plan = await api<{ plan: { approveUrl: string | null } }>("/api/paypal/plan", { billId, monthly: neg.deal.monthly, months: neg.deal.months });
      setApproveUrl(plan.plan.approveUrl);
      setStep("pay");
    });

  const idx = STEPS.indexOf(step);
  const months = Math.ceil((audit?.estimatedShare.amount || 0) / budget);

  return (
    <div className="phone">
      <div className="topbar">
        <h1>Clearbill</h1>
        <p>Understand your bill. Agree a plan. Pay with PayPal.</p>
      </div>
      <div className="steps">
        {STEPS.slice(0, 6).map((s, i) => (
          <i key={s} className={i <= idx ? "on" : ""} />
        ))}
      </div>

      <div className="screen">
        {error && <div className="err">{error}</div>}

        {step === "home" && (
          <>
            <div className="notice">
              <b>Demo with fictional data.</b> Please do not upload your own real medical bill. Payments use the PayPal sandbox (test money).
            </div>
            <p className="muted" style={{ marginTop: 0 }}>
              In the US, you get care first and the bill arrives weeks later. Pick a sample bill to see what Clearbill does.
            </p>
            {bills.map((b, i) => (
              <div key={b.id} className="card" style={i === 0 ? { borderColor: "var(--purple)", borderWidth: 2 } : undefined}>
                {i === 0 && <span className="pill" style={{ background: "var(--purple)" }}>Featured story</span>}
                <h3 style={{ marginTop: i === 0 ? 8 : 0 }}>{b.patient}</h3>
                <div className="muted">{b.title}</div>
                <div className="row" style={{ marginTop: 10, alignItems: "center" }}>
                  <span className="amt" style={{ fontSize: 18 }}>{usd(b.total, 2)}</span>
                  <button className="btn sm" disabled={busy} onClick={() => pick(b.id)}>Open bill</button>
                </div>
              </div>
            ))}
          </>
        )}

        {step === "bill" && audit && (
          <>
            <div className="muted">{audit.bill.provider.name}</div>
            <div className="big">{usd(audit.bill.total_charges, 2)}</div>
            <div className="muted">
              {audit.bill.patient.name} · visit {audit.bill.date_of_service}
              {audit.bill.discharge_date ? ` to ${audit.bill.discharge_date}` : ""}
            </div>
            {/denied/i.test(audit.bill.insurance.note) && <div className="denied"><b>Insurance:</b> {audit.bill.insurance.note}. Your insurer paid {usd(audit.bill.insurance.paid)}.</div>}
            <div className="card">
              <h3>What each line means</h3>
              {audit.lines.map((l) => (
                <div key={l.line} className="line">
                  <div className="row">
                    <b>{l.description}{l.quantity > 1 ? ` (x${l.quantity})` : ""}</b>
                    <span className="amt">{usd(l.charge, 2)}</span>
                  </div>
                  <div className="plain">{l.plain}</div>
                </div>
              ))}
            </div>
            <button className="btn" onClick={() => setStep("check")}>Check my bill for mistakes</button>
          </>
        )}

        {step === "check" && audit && (
          <>
            <h2 style={{ margin: "0 0 8px" }}>{audit.findings.length ? `We found ${audit.findings.length} thing${audit.findings.length > 1 ? "s" : ""} to question` : "This bill looks correct"}</h2>
            {audit.ai && (
              <div className="card" style={{ background: "#f3f0ff", borderColor: "var(--purple)" }}>
                <div className="row"><h3>AI summary</h3><span className="pill" style={{ background: "var(--purple)" }}>AI</span></div>
                <div style={{ fontSize: 14, lineHeight: 1.45 }}>{audit.ai.summary}</div>
                {audit.ai.questions.length > 0 && (
                  <>
                    <div className="muted" style={{ marginTop: 8, fontWeight: 700 }}>Questions to ask</div>
                    <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 13, lineHeight: 1.45 }}>
                      {audit.ai.questions.map((q, i) => <li key={i}>{q}</li>)}
                    </ul>
                  </>
                )}
              </div>
            )}
            {!audit.aiEnabled && <div className="notice">AI is switched off (no model key), so you see rule-based checks only.</div>}
            {audit.findings.length === 0 && <div className="ok">Nothing looks wrong. We will not invent errors. You can still set up a payment plan.</div>}
            {audit.findings.map((f) => (
              <div key={f.id} className={`card flag ${f.confidence}`}>
                <div className="row">
                  <h3>{f.title}</h3>
                  <span className={`pill ${f.confidence === "high" ? "high" : ""}`}>{f.source === "ai" ? "AI: ask to check" : f.confidence === "high" ? "Looks wrong" : "Ask to check"}</span>
                </div>
                <div className="muted">{f.explain}</div>
                <div style={{ fontSize: 13, marginTop: 6 }}><b>What to do:</b> {f.fix}</div>
                {f.savings ? <div className="amt" style={{ marginTop: 6, color: "var(--green)" }}>Could save {usd(f.savings, 2)}</div> : null}
              </div>
            ))}
            <div className="card" style={{ background: "#fff" }}>
              <div className="muted">Charges after corrections</div>
              <div className="amt" style={{ fontSize: 20 }}>{usd(audit.correctedCharges, 2)}</div>
              <div className="muted" style={{ marginTop: 8 }}>Estimated amount you will owe</div>
              <div className="big" style={{ color: "var(--purple)" }}>{usd(audit.estimatedShare.amount, 2)}</div>
              <div className="muted">{audit.estimatedShare.basis} This is an estimate, not a promise.</div>
            </div>
            <button className="btn" disabled={audit.estimatedShare.amount <= 0} onClick={() => setStep("budget")}>What can I afford each month?</button>
          </>
        )}

        {step === "budget" && audit && (
          <>
            <h2 style={{ margin: "0 0 4px" }}>Your monthly budget</h2>
            <p className="muted" style={{ marginTop: 0 }}>Your agent will offer this to the clinic. You approve the final plan.</p>
            <div className="card" style={{ textAlign: "center" }}>
              <div className="big">{usd(budget)}<span style={{ fontSize: 16 }}> / month</span></div>
              <input className="slider" type="range" min={50} max={600} step={10} value={budget} onChange={(e) => setBudget(Number(e.target.value))} aria-label="Monthly budget" />
              <div className="muted">About {months} months to pay {usd(audit.estimatedShare.amount, 2)}</div>
            </div>
            <button className="btn alt" disabled={busy} onClick={send}>{busy ? "Contacting the clinic's agent..." : "Send to the clinic's agent"}</button>
          </>
        )}

        {step === "agents" && neg && (
          <>
            <h2 style={{ margin: "0 0 4px" }}>The agents talk</h2>
            <p className="muted" style={{ marginTop: 0 }}>Your agent and the clinic's agent follow clear rules. Nothing is final until you approve.</p>
            {neg.rounds.slice(0, shown).map((r, i) => (
              <div key={i} className={`bubble ${r.from}`}>
                <small>{r.from === "patient" ? "Your agent" : "Clinic agent"}</small>
                {r.message}
              </div>
            ))}
            {shown < neg.rounds.length && <div className="muted">...</div>}
            {shown >= neg.rounds.length && (
              <>
                <div className="deal">
                  <div style={{ fontSize: 13, opacity: 0.9 }}>{neg.deal.outcome === "agreed" ? "Proposed plan" : "Closest plan (financial assistance may help)"}</div>
                  <div className="big">{usd(neg.deal.monthly, 2)} / month</div>
                  <div style={{ fontSize: 14 }}>for {neg.deal.months} months · total {usd(neg.deal.total, 2)} · no interest</div>
                </div>
                <button className="btn" disabled={busy} onClick={startPaypal}>{busy ? "Setting up PayPal..." : "Approve and set up with PayPal"}</button>
              </>
            )}
          </>
        )}

        {step === "pay" && (
          <>
            <h2 style={{ margin: "0 0 4px" }}>Your PayPal plan</h2>
            {invoice && (
              <div className="card">
                <h3>Invoice {invoice.number}</h3>
                <div className="muted">Itemized statement from the clinic. You could also pay in full with this invoice.</div>
                {invoice.qrBase64 && <img className="qr" alt="Invoice QR code" src={`data:image/png;base64,${invoice.qrBase64}`} />}
                {invoice.viewUrl && <a href={invoice.viewUrl} target="_blank" rel="noreferrer">Open invoice</a>}
              </div>
            )}
            {neg && (
              <div className="card">
                <h3>Monthly plan</h3>
                <div className="muted">{usd(neg.deal.monthly, 2)} a month for {neg.deal.months} months, billed automatically by PayPal.</div>
              </div>
            )}
            {approveUrl ? <a className="btn alt" href={approveUrl}>Approve the plan with PayPal</a> : <div className="err">PayPal did not return an approval link.</div>}
            <p className="muted" style={{ textAlign: "center" }}>You will sign in with a PayPal sandbox test account.</p>
          </>
        )}

        {step === "done" && (
          <>
            <div className={subStatus === "ACTIVE" ? "ok" : "notice"}>
              <b>{subStatus === "ACTIVE" ? "Your plan is active." : "Returned from PayPal."}</b>{" "}
              {subStatus ? `PayPal status: ${subStatus}.` : "Checking your plan..."}
            </div>
            <p className="muted">The clinic dashboard now shows your plan. No more chasing, no more surprises.</p>
            <a className="btn alt" href="/clinic" target="_blank" rel="noreferrer">See the clinic's view</a>
            <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => { window.history.replaceState({}, "", "/"); setStep("home"); }}>Back to start</button>
          </>
        )}
      </div>
      <div className="foot">Prototype. Fictional data. PayPal sandbox. Not medical, legal or financial advice.</div>
    </div>
  );
}
