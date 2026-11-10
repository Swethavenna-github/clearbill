"use client";

import { useEffect, useRef, useState } from "react";

type User = { id: string; name: string; initials: string; blurb: string };
type Clinic = { name: string; kind: string; city: string };
type BillRow = { id: string; title: string; patient: string; total: number };
type Fields = {
  provider: string;
  dateOfService: string;
  dischargeDate: string;
  lines: { description: string; quantity: number; amount: number }[];
  insuranceStatus: string;
  insurancePaid: number;
  balanceShown: number;
  notes: string;
};
type CustomInput = {
  id: string;
  patientName: string;
  provider: string;
  dateOfService: string;
  dischargeDate?: string;
  lines: { description: string; quantity: number; amount: number }[];
  insuranceStatus: "paid" | "denied" | "not_sent" | "none";
  insurancePaid?: number;
  balanceShown?: number;
  outOfPocketMax?: number;
  notes?: string;
};
type LocalBill = CustomInput & { thumb?: string; savedAt: number };
type BillRef = { billId?: string; bill?: CustomInput };
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
type Step = "welcome" | "unregistered" | "home" | "add" | "bill" | "check" | "budget" | "agents" | "pay" | "done";
type Tab = "bills" | "emis" | "cycle";
type Initial = { fields?: Fields; thumb?: string; note?: string };
// An installment plan (EMI). "sample" plans are fictional; the others were set up through PayPal in this app.
type Plan = {
  id: string;
  provider: string;
  title: string;
  monthly: number;
  months: number;
  paid: number;
  nextDue: string;
  status: string;
  sample: boolean;
  thisMonthDue?: string;
  thisMonthState?: "paid" | "upcoming";
  subscriptionId?: string;
  approveUrl?: string | null;
  createdAt?: string;
};
type CycleItem = { date: string; provider: string; title: string; amount: number; state: "paid" | "upcoming"; sample: boolean };

const usd = (n: number, d = 0) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const FLOW = ["home", "bill", "check", "budget", "agents", "pay"] as const;
const fmtDate = (iso: string) => new Date(iso.slice(0, 10) + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
// Only called from event handlers, never while the page is being prerendered.
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

async function api<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : undefined);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data as T;
}

// "Local database": bills and plans a person saves stay on this phone only (browser storage).
const store = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage full or blocked: keep going */
    }
  },
  remove(key: string) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => reject(new Error("Could not open that photo."));
    img.src = url;
  });
}

function shrink(img: HTMLImageElement, max: number, quality: number) {
  const s = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(img.width * s));
  c.height = Math.max(1, Math.round(img.height * s));
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", quality);
}

function cycleItems(plans: Plan[], ym: string): CycleItem[] {
  const out: CycleItem[] = [];
  for (const p of plans) {
    if (p.sample) {
      if (p.thisMonthDue && p.thisMonthDue.startsWith(ym) && p.thisMonthState) {
        out.push({ date: p.thisMonthDue, provider: p.provider, title: p.title, amount: p.monthly, state: p.thisMonthState, sample: true });
      }
    } else if (p.status === "ACTIVE") {
      if (p.createdAt && p.createdAt.startsWith(ym)) out.push({ date: p.createdAt, provider: p.provider, title: p.title, amount: p.monthly, state: "paid", sample: false });
      if (p.nextDue && p.nextDue.startsWith(ym) && p.nextDue !== p.createdAt) out.push({ date: p.nextDue, provider: p.provider, title: p.title, amount: p.monthly, state: "upcoming", sample: false });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export default function Patient() {
  const [step, setStep] = useState<Step>("welcome");
  const [tab, setTab] = useState<Tab>("bills");
  const [phone, setPhone] = useState("");
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [typed, setTyped] = useState("");
  const [reqName, setReqName] = useState("");
  const [reqMsg, setReqMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<"clinic" | "local">("clinic");
  const [sample, setSample] = useState<BillRow[]>([]);
  const [mine, setMine] = useState<LocalBill[]>([]);
  const [samplePlans, setSamplePlans] = useState<Plan[]>([]);
  const [myPlans, setMyPlans] = useState<Plan[]>([]);
  const [planLive, setPlanLive] = useState<Record<string, { status: string; nextBilling: string | null }>>({});
  const [sheet, setSheet] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [initial, setInitial] = useState<Initial>({});
  const [ref, setRef] = useState<BillRef>({});
  const [audit, setAudit] = useState<AuditResp | null>(null);
  const [budget, setBudget] = useState(200);
  const [neg, setNeg] = useState<NegResp | null>(null);
  const [shown, setShown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [invoice, setInvoice] = useState<{ number: string; viewUrl: string | null; qrBase64: string | null } | null>(null);
  const [approveUrl, setApproveUrl] = useState<string | null>(null);
  const [subStatus, setSubStatus] = useState("");
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  // The current date is read after the page loads in the browser (not during prerender).
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
  }, []);

  const owner = mode === "local" ? "local" : user?.id || "local";
  const billsKey = (o: string) => `cb_bills_${o}`;
  const plansKey = (o: string) => `cb_plans_${o}`;

  const enterClinic = (u: User, ph: string) => {
    setUser(u);
    setMode("clinic");
    setPhone(ph);
    setTab("bills");
    store.set("cb_session", { mode: "clinic", phone: ph });
    setMine(store.get<LocalBill[]>(billsKey(u.id), []));
    setMyPlans(store.get<Plan[]>(plansKey(u.id), []));
    api<{ bills: BillRow[] }>(`/api/audit?user=${u.id}`).then((d) => setSample(d.bills)).catch(() => setSample([]));
    api<{ plans: Omit<Plan, "sample">[] }>(`/api/plans?user=${u.id}`)
      .then((d) => setSamplePlans(d.plans.map((p) => ({ ...p, sample: true }))))
      .catch(() => setSamplePlans([]));
    setStep("home");
  };

  const enterLocal = () => {
    setUser(null);
    setMode("local");
    setTab("bills");
    setSample([]);
    setSamplePlans([]);
    store.set("cb_session", { mode: "local" });
    setMine(store.get<LocalBill[]>(billsKey("local"), []));
    setMyPlans([]);
    setStep("home");
  };

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const session = store.get<{ mode?: string; phone?: string }>("cb_session", {});
    const restore = async () => {
      if (session.mode === "clinic" && session.phone) {
        try {
          const r = await api<{ registered: boolean; user?: User }>("/api/login", { phone: session.phone });
          if (r.registered && r.user) enterClinic(r.user, session.phone);
        } catch {
          /* show the welcome screen */
        }
      } else if (session.mode === "local") enterLocal();
      if (q.get("paid") && q.get("bill")) {
        setStep("done");
        fetch(`/api/paypal/status?bill=${encodeURIComponent(q.get("bill")!)}&subscription_id=${q.get("subscription_id") || ""}`)
          .then((r) => r.json())
          .then((s) => setSubStatus(s.subscription?.status || s.error || ""));
      }
    };
    restore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (step === "agents" && neg && shown < neg.rounds.length) {
      const t = setTimeout(() => setShown((s) => s + 1), 1300);
      return () => clearTimeout(t);
    }
  }, [step, neg, shown]);

  // Ask PayPal for the real status of plans set up in this app whenever the EMI or cycle tab is shown.
  useEffect(() => {
    if (step !== "home" || tab === "bills") return;
    myPlans
      .filter((p) => p.subscriptionId)
      .forEach((p) => {
        fetch(`/api/paypal/status?subscription_id=${encodeURIComponent(p.subscriptionId!)}`)
          .then((r) => r.json())
          .then((d) => {
            if (d.subscription) setPlanLive((m) => ({ ...m, [p.id]: { status: d.subscription.status, nextBilling: d.subscription.nextBilling } }));
          })
          .catch(() => {});
      });
  }, [step, tab, myPlans]);

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

  const signIn = () =>
    run(async () => {
      const digits = phone.replace(/\D/g, "");
      if (digits.length < 9) throw new Error("Enter your phone number.");
      const r = await api<{ registered: boolean; user?: User; clinics?: Clinic[] }>("/api/login", { phone });
      if (r.registered && r.user) return enterClinic(r.user, phone);
      setTyped(phone);
      setClinics(r.clinics || []);
      setStep("unregistered");
    });

  // Ask the clinic to register this phone number. A staff member reviews it in the clinic dashboard.
  const askToRegister = () =>
    run(async () => {
      setReqMsg(null);
      try {
        await api("/api/requests", { name: reqName, phone: typed });
        setReqMsg({ ok: true, text: "Request sent. When the clinic approves it, come back and sign in with this number." });
      } catch (e) {
        setReqMsg({ ok: false, text: (e as Error).message });
      }
    });

  const signOut = () => {
    store.remove("cb_session");
    setUser(null);
    setAudit(null);
    setNeg(null);
    setPhone("");
    setError("");
    setStep("welcome");
  };

  const open = (r: BillRef, defaultBudget: number) =>
    run(async () => {
      const d = await api<AuditResp>("/api/audit", { ...r, userId: user?.id });
      setAudit(d);
      setRef(r);
      setNeg(null);
      setInvoice(null);
      setApproveUrl(null);
      setBudget(defaultBudget);
      setStep("bill");
    });

  const send = () =>
    run(async () => {
      const d = await api<NegResp>("/api/negotiate", { ...ref, userId: user?.id, budget });
      setNeg(d);
      setShown(0);
      setStep("agents");
    });

  const startPaypal = () =>
    run(async () => {
      if (!neg) return;
      const inv = await api<{ invoice: { number: string; viewUrl: string | null; qrBase64: string | null } }>("/api/paypal/invoice", { ...ref, userId: user?.id });
      setInvoice(inv.invoice);
      const plan = await api<{ plan: { approveUrl: string | null; subscriptionId: string } }>("/api/paypal/plan", { ...ref, userId: user?.id, monthly: neg.deal.monthly, months: neg.deal.months });
      setApproveUrl(plan.plan.approveUrl);
      // Remember the plan on this phone so it shows up in the "Active EMIs" tab.
      const p: Plan = {
        id: plan.plan.subscriptionId,
        provider: audit?.bill.provider.name || "Clinic",
        title: `Medical bill, visit ${audit?.bill.date_of_service || ""}`.trim(),
        monthly: neg.deal.monthly,
        months: neg.deal.months,
        paid: 0,
        nextDue: "",
        status: "APPROVAL_PENDING",
        sample: false,
        subscriptionId: plan.plan.subscriptionId,
        approveUrl: plan.plan.approveUrl,
        createdAt: todayIso(),
      };
      const next = [p, ...myPlans.filter((x) => x.id !== p.id)];
      setMyPlans(next);
      store.set(plansKey(owner), next);
      setStep("pay");
    });

  const onPhoto = async (file: Blob | undefined | null) => {
    if (!file) return;
    setSheet(false);
    setError("");
    setScanning(true);
    try {
      const img = await loadImage(file);
      const full = shrink(img, 1400, 0.8);
      const thumb = shrink(img, 300, 0.6);
      try {
        const r = await api<{ scanned: boolean; fields?: Fields; reason?: string }>("/api/scan", { image: full });
        setInitial(r.scanned && r.fields ? { fields: r.fields, thumb, note: r.fields.lines.length ? "" : "We could not find any charges. Please type them in." } : { thumb, note: r.reason || "We could not read the photo." });
      } catch (e) {
        setInitial({ thumb, note: (e as Error).message });
      }
      setStep("add");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setScanning(false);
    }
  };

  const useSamplePhoto = async () => {
    setSheet(false);
    try {
      const res = await fetch("/sample-bill-1.jpg");
      await onPhoto(await res.blob());
    } catch {
      setError("Could not load the sample photo.");
    }
  };

  const saveBill = (b: LocalBill) => {
    const next = [b, ...mine];
    setMine(next);
    store.set(billsKey(owner), next);
    setInitial({});
    setTab("bills");
    setStep("home");
  };

  const deleteBill = (id: string) => {
    const next = mine.filter((b) => b.id !== id);
    setMine(next);
    store.set(billsKey(owner), next);
  };

  const idx = FLOW.indexOf(step as (typeof FLOW)[number]);
  const months = Math.ceil((audit?.estimatedShare.amount || 0) / budget);
  const total = (b: CustomInput) => b.lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const isClinicBill = Boolean(ref.billId);
  const registered = mode === "clinic" && Boolean(user);

  // Plans shown in the EMI and cycle tabs: real PayPal plans first, then the fictional samples.
  const livePlans: Plan[] = myPlans.map((p) => {
    const l = planLive[p.id];
    const status = l?.status || p.status;
    return { ...p, status, paid: status === "ACTIVE" ? 1 : 0, nextDue: l?.nextBilling ? l.nextBilling.slice(0, 10) : p.nextDue };
  });
  const allPlans = [...livePlans, ...samplePlans];
  const ym = now ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}` : "";
  const items = ym ? cycleItems(allPlans, ym) : [];
  const duePaid = items.filter((i) => i.state === "paid").reduce((s, i) => s + i.amount, 0);
  const dueLeft = items.filter((i) => i.state === "upcoming").reduce((s, i) => s + i.amount, 0);
  const monthName = now ? now.toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "";

  return (
    <div className="phone">
      <div className="topbar">
        <div className="row" style={{ alignItems: "center" }}>
          <div>
            <h1>Clearbill</h1>
            <p>Understand your bill. Agree a plan. Pay with PayPal.</p>
          </div>
          {(user || mode === "local") && step !== "welcome" && step !== "unregistered" && (
            <button className="chip" onClick={signOut}>
              <span className="avatar sm">{user ? user.initials : "ME"}</span> {user ? "Sign out" : "Exit"}
            </button>
          )}
        </div>
      </div>
      {step !== "welcome" && step !== "unregistered" && step !== "add" && step !== "home" && (
        <div className="steps">
          {FLOW.map((s, i) => (
            <i key={s} className={i <= idx || step === "done" ? "on" : ""} />
          ))}
        </div>
      )}

      <div className="screen">
        {error && <div className="err">{error}</div>}

        {step === "welcome" && (
          <>
            <h2 style={{ margin: "6px 0 4px" }}>Welcome</h2>
            <p className="muted" style={{ marginTop: 0 }}>
              Enter the phone number your clinic has on file. We use it to find your bills.
            </p>
            <label className="field">Mobile number
              <span className="phoneRow">
                <span className="prefix" aria-hidden="true">🇺🇸 +1</span>
                <input
                  className="inp phoneInp"
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  placeholder="123 456 789"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^\d\s()-]/g, "").slice(0, 16))}
                  onKeyDown={(e) => e.key === "Enter" && signIn()}
                  aria-label="Mobile number, United States"
                />
              </span>
            </label>
            <div className="muted" style={{ margin: "-4px 0 14px" }}>Demo number: <b>123 456 789</b>. Any other number shows how a new patient is guided to register.</div>
            <button className="btn" disabled={busy} onClick={signIn}>{busy ? "Checking..." : "Continue"}</button>
            <div className="notice" style={{ marginTop: 16 }}>
              <b>Demo with fictional data.</b> Real text-message verification and secure accounts would be added for a real launch.
            </div>
          </>
        )}

        {step === "unregistered" && (
          <>
            <div className="denied" style={{ marginTop: 0 }}>
              <b>Invalid number.</b> +1 {typed} is not registered with any clinic that uses Clearbill.
            </div>
            <h2 style={{ margin: "6px 0 4px" }}>Register with your clinic</h2>
            <p className="muted" style={{ marginTop: 0 }}>
              Clearbill works together with your clinic. Ask the front desk to add your phone number, then sign in again to see your bills and set up a payment plan. These clinics use Clearbill:
            </p>
            {clinics.map((c) => (
              <div key={c.name} className="card">
                <h3>{c.name}</h3>
                <div className="muted">{c.kind} · {c.city}</div>
              </div>
            ))}
            <div className="card" style={{ background: "#fff", borderColor: "var(--purple)", borderWidth: 2 }}>
              <h3>Ask Riverbend to register me</h3>
              <div className="muted" style={{ marginBottom: 8 }}>Send your name with +1 {typed}. The clinic's front desk reviews the request. This is a demo, so use a made-up name.</div>
              {reqMsg && <div className={reqMsg.ok ? "ok" : "err"}>{reqMsg.text}</div>}
              {!reqMsg?.ok && (
                <>
                  <label className="field">Your full name
                    <input className="inp" value={reqName} onChange={(e) => setReqName(e.target.value)} placeholder="e.g. Jordan Lee" maxLength={60} />
                  </label>
                  <button className="btn" disabled={busy || reqName.trim().length < 2} onClick={askToRegister}>{busy ? "Sending..." : "Send request to the clinic"}</button>
                </>
              )}
            </div>
            <div className="card" style={{ background: "#e8f8f7", borderColor: "var(--teal)" }}>
              <h3>Not registered yet?</h3>
              <div className="muted">You can still keep your bills on this phone and check them for mistakes. They stay on your phone and are not shared with a clinic.</div>
            </div>
            <button className="btn alt" onClick={enterLocal}>Keep my bills on this phone</button>
            <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => setStep("welcome")}>Try another number</button>
          </>
        )}

        {step === "home" && tab === "bills" && (
          <>
            {registered && user ? (
              <>
                <h2 style={{ margin: "0 0 2px" }}>Hi, {user.name.split(" ")[0]}</h2>
                <p className="muted" style={{ marginTop: 0 }}>Signed in as +1 {phone}. Here are your bills.</p>
              </>
            ) : (
              <>
                <h2 style={{ margin: "0 0 2px" }}>Your bills</h2>
                <div className="notice">Your bills stay on this phone only and are not shared with a clinic. To set up a payment plan, ask your clinic to register your phone number.</div>
              </>
            )}
            <div className="notice"><b>Demo with fictional data.</b> Please do not add your own real medical bill. Payments use the PayPal sandbox (test money).</div>

            {registered && sample.length > 0 && <div className="sect">From your clinic</div>}
            {registered &&
              sample.map((b) => (
                <div key={b.id} className="card" style={{ borderColor: "var(--purple)", borderWidth: 2 }}>
                  <span className="pill" style={{ background: "var(--purple)" }}>Synced from clinic</span>
                  <h3 style={{ marginTop: 8 }}>{b.title}</h3>
                  <div className="row" style={{ marginTop: 10, alignItems: "center" }}>
                    <span className="amt" style={{ fontSize: 18 }}>{usd(b.total, 2)}</span>
                    <button className="btn sm" disabled={busy} onClick={() => open({ billId: b.id }, 200)}>Open bill</button>
                  </div>
                </div>
              ))}

            <div className="row" style={{ alignItems: "center", margin: "14px 0 8px" }}>
              <div className="sect" style={{ margin: 0 }}>{registered ? "Other bills on this phone" : "Saved on this phone"}</div>
              <button className="btn sm ghost" style={{ padding: "6px 12px", fontSize: 13 }} onClick={() => setSheet(true)}>+ Add a bill</button>
            </div>
            {mine.length === 0 && (
              <div className="addcard">
                <b>{registered ? "Got another bill or an insurance statement?" : "Add your first bill"}</b>
                <div className="muted" style={{ margin: "4px 0 10px" }}>
                  {registered ? "Bills from other providers (the ER doctors, a lab, an ambulance) or a paper copy of a bill. Take a photo and Clearbill checks it." : "Take a photo of a bill or type it in. Clearbill checks it for mistakes."}
                </div>
                <button className="btn sm" onClick={() => setSheet(true)}>Add a bill</button>
              </div>
            )}
            {mine.map((b) => (
              <div key={b.id} className="card">
                <div className="row" style={{ alignItems: "center", gap: 12 }}>
                  {b.thumb && <img className="thumb" src={b.thumb} alt="" />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span className="pill" style={{ background: "var(--teal)" }}>On this phone</span>
                    <h3 style={{ marginTop: 6 }}>{b.provider}</h3>
                    <div className="muted">Visit {b.dateOfService}</div>
                  </div>
                </div>
                <div className="row" style={{ marginTop: 10, alignItems: "center" }}>
                  <span className="amt" style={{ fontSize: 18 }}>{usd(total(b), 2)}</span>
                  <span style={{ display: "flex", gap: 8 }}>
                    <button className="btn sm ghost" onClick={() => deleteBill(b.id)} aria-label={`Delete ${b.provider}`}>Delete</button>
                    <button className="btn sm" disabled={busy} onClick={() => open({ bill: b }, 150)}>Open bill</button>
                  </span>
                </div>
              </div>
            ))}
          </>
        )}

        {step === "home" && tab === "emis" && (
          <>
            <h2 style={{ margin: "0 0 2px" }}>Active EMIs</h2>
            <p className="muted" style={{ marginTop: 0 }}>Your monthly payment plans. EMI means equal monthly installments.</p>
            {allPlans.length === 0 && (
              <div className="addcard">
                <b>No active plans yet</b>
                <div className="muted" style={{ marginTop: 4 }}>
                  {registered ? "Open a bill from your clinic, check it, and set up a monthly plan. It will show up here." : "Payment plans are set up with a registered clinic. Ask your clinic to register your phone number."}
                </div>
              </div>
            )}
            {allPlans.map((p) => {
              const pct = Math.min(100, Math.round((p.paid / p.months) * 100));
              const pending = p.status === "APPROVAL_PENDING";
              return (
                <div key={p.id} className="card">
                  <div className="row" style={{ alignItems: "flex-start" }}>
                    <div>
                      <h3>{p.provider}</h3>
                      <div className="muted">{p.title}</div>
                    </div>
                    <span className="pill" style={{ background: pending ? "var(--orange)" : p.status === "ACTIVE" ? "var(--green)" : "var(--muted)" }}>
                      {pending ? "Needs approval" : p.status === "ACTIVE" ? "Active" : p.status.toLowerCase()}
                    </span>
                  </div>
                  <div className="row" style={{ marginTop: 10, alignItems: "baseline" }}>
                    <span className="amt" style={{ fontSize: 20 }}>{usd(p.monthly, 2)}<span className="muted"> / month</span></span>
                    <span className="muted">{p.paid} of {p.months} paid</span>
                  </div>
                  <div className="track" style={{ margin: "8px 0" }}><div className="fill" style={{ width: `${pct}%` }} /></div>
                  {pending ? (
                    p.approveUrl ? <a className="btn sm alt" href={p.approveUrl}>Finish approval in PayPal</a> : <div className="muted">Waiting for approval in PayPal.</div>
                  ) : (
                    <div className="muted">Next payment: <b>{p.nextDue ? fmtDate(p.nextDue) : "to be scheduled"}</b> · {usd(Math.max(0, (p.months - p.paid) * p.monthly))} left</div>
                  )}
                  <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>{p.sample ? "Sample plan (fictional)" : "Set up with PayPal (sandbox)"}</div>
                </div>
              );
            })}
          </>
        )}

        {step === "home" && tab === "cycle" && (
          <>
            <h2 style={{ margin: "0 0 2px" }}>This bill cycle</h2>
            <p className="muted" style={{ marginTop: 0 }}>{monthName}. What you pay this month across your plans.</p>
            <div className="sumgrid">
              <div className="sum"><span>Due this cycle</span><b>{usd(duePaid + dueLeft, 2)}</b></div>
              <div className="sum"><span>Paid so far</span><b style={{ color: "var(--green)" }}>{usd(duePaid, 2)}</b></div>
              <div className="sum"><span>Still to pay</span><b style={{ color: "var(--purple)" }}>{usd(dueLeft, 2)}</b></div>
            </div>
            {items.length === 0 && (
              <div className="addcard">
                <b>Nothing due this month</b>
                <div className="muted" style={{ marginTop: 4 }}>When you have a payment plan, its payments for this month appear here.</div>
              </div>
            )}
            {items.map((it, i) => (
              <div key={i} className="card">
                <div className="row" style={{ alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div className="datebox"><b>{fmtDate(it.date).split(" ")[1]}</b><span>{fmtDate(it.date).split(" ")[0]}</span></div>
                    <div>
                      <h3>{it.provider}</h3>
                      <div className="muted">{it.title}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="amt">{usd(it.amount, 2)}</div>
                    <span className="pill" style={{ background: it.state === "paid" ? "var(--green)" : "var(--orange)" }}>{it.state === "paid" ? "Paid" : "Upcoming"}</span>
                  </div>
                </div>
              </div>
            ))}
            <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>Amounts come from your plans. Sample plans are fictional.</div>
          </>
        )}

        {step === "add" && <AddBill owner={owner} name={user?.name || "Me"} initial={initial} onSave={saveBill} onCancel={() => { setInitial({}); setStep("home"); }} />}

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
            <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => { setTab("bills"); setStep("home"); }}>Back to my bills</button>
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
            {audit.findings.length === 0 && <div className="ok">Nothing looks wrong. We will not invent errors.</div>}
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
            {isClinicBill ? (
              <button className="btn" disabled={audit.estimatedShare.amount <= 0} onClick={() => setStep("budget")}>What can I afford each month?</button>
            ) : (
              <div className="card" style={{ background: "#e8f8f7", borderColor: "var(--teal)" }}>
                <h3>Want a payment plan?</h3>
                <div className="muted">This bill is saved only on your phone. Show the questions above to your clinic, and ask them to register your phone number so Clearbill can set up a plan with them through PayPal.</div>
              </div>
            )}
            <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => { setTab("bills"); setStep("home"); }}>Back to my bills</button>
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
            <button className="btn" onClick={() => { window.history.replaceState({}, "", "/"); setTab("emis"); setStep(user || mode === "local" ? "home" : "welcome"); }}>See my active EMIs</button>
            <a className="btn alt" style={{ marginTop: 10 }} href="/clinic" target="_blank" rel="noreferrer">See the clinic's view</a>
            <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => { window.history.replaceState({}, "", "/"); setTab("bills"); setStep(user || mode === "local" ? "home" : "welcome"); }}>Back to my bills</button>
          </>
        )}
      </div>

      {sheet && (
        <div className="sheetBack" onClick={() => setSheet(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Add a bill">
            <div className="grab" />
            <h3 style={{ margin: "0 0 4px", fontSize: 18 }}>{registered ? "Add another bill" : "Add a bill"}</h3>
            <div className="muted" style={{ marginBottom: 10 }}>
              {registered ? "A bill from another provider, or the paper copy of a bill. " : ""}Fictional bills only. Photos are read by an AI model and are not stored on our server.
            </div>
            <button className="sheetBtn" onClick={() => camRef.current?.click()}><span className="ico">📷</span><span><b>Take a photo</b><br /><span className="muted">Use your camera on a paper bill</span></span></button>
            <button className="sheetBtn" onClick={() => galRef.current?.click()}><span className="ico">🖼️</span><span><b>Choose from gallery</b><br /><span className="muted">Pick a photo or screenshot</span></span></button>
            <button className="sheetBtn" onClick={() => { setInitial({}); setSheet(false); setStep("add"); }}><span className="ico">⌨️</span><span><b>Type it in</b><br /><span className="muted">Enter the charges yourself</span></span></button>
            <button className="sheetBtn" onClick={useSamplePhoto}><span className="ico">🧾</span><span><b>Try a sample bill photo</b><br /><span className="muted">For testing without a paper bill</span></span></button>
            <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => setSheet(false)}>Cancel</button>
          </div>
        </div>
      )}
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { onPhoto(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={galRef} type="file" accept="image/*" hidden onChange={(e) => { onPhoto(e.target.files?.[0]); e.target.value = ""; }} />
      {scanning && (
        <div className="sheetBack" style={{ alignItems: "center" }}>
          <div className="scanBox"><div className="spin" /><b>Reading your bill...</b><div className="muted">This takes a few seconds.</div></div>
        </div>
      )}

      <div className="foot">Prototype. Fictional data. PayPal sandbox. Not medical, legal or financial advice.</div>

      {step === "home" && (
        <nav className="tabbar" aria-label="Main sections">
          <button className={`tab ${tab === "bills" ? "on" : ""}`} onClick={() => setTab("bills")} aria-current={tab === "bills" ? "page" : undefined}><span className="ti">🧾</span>Bills</button>
          <button className={`tab ${tab === "emis" ? "on" : ""}`} onClick={() => setTab("emis")} aria-current={tab === "emis" ? "page" : undefined}><span className="ti">🔁</span>Active EMIs</button>
          <button className={`tab ${tab === "cycle" ? "on" : ""}`} onClick={() => setTab("cycle")} aria-current={tab === "cycle" ? "page" : undefined}><span className="ti">📅</span>This cycle</button>
        </nav>
      )}
    </div>
  );
}

function AddBill({ owner, name, initial, onSave, onCancel }: { owner: string; name: string; initial: Initial; onSave: (b: LocalBill) => void; onCancel: () => void }) {
  const f = initial.fields;
  const [provider, setProvider] = useState(f?.provider || "");
  const [dos, setDos] = useState(f?.dateOfService || "");
  const [dis, setDis] = useState(f?.dischargeDate || "");
  const [lines, setLines] = useState(
    f && f.lines.length
      ? f.lines.map((l) => ({ description: l.description, quantity: String(l.quantity), amount: String(l.amount) }))
      : [{ description: "", quantity: "1", amount: "" }, { description: "", quantity: "1", amount: "" }],
  );
  const [ins, setIns] = useState<CustomInput["insuranceStatus"]>((f?.insuranceStatus as CustomInput["insuranceStatus"]) || "not_sent");
  const [insPaid, setInsPaid] = useState(f?.insurancePaid ? String(f.insurancePaid) : "");
  const [balance, setBalance] = useState(f?.balanceShown ? String(f.balanceShown) : "");
  const [oop, setOop] = useState("");
  const [notes, setNotes] = useState(f?.notes || "");
  const [err, setErr] = useState("");

  const setLine = (i: number, k: "description" | "quantity" | "amount", v: string) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const total = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);

  const submit = () => {
    const filled = lines.filter((l) => l.description.trim() || Number(l.amount) > 0);
    if (!provider.trim()) return setErr("Add the hospital or clinic name.");
    if (!dos) return setErr("Add the date of the visit.");
    if (filled.length === 0) return setErr("Add at least one charge.");
    if (filled.some((l) => !l.description.trim() || !(Number(l.amount) > 0))) return setErr("Each charge needs a description and an amount.");
    if (ins === "paid" && !(Number(insPaid) > 0)) return setErr("Enter how much insurance paid.");
    onSave({
      id: `u-${owner}-${Date.now().toString(36)}`,
      patientName: name,
      provider: provider.trim(),
      dateOfService: dos,
      ...(dis ? { dischargeDate: dis } : {}),
      lines: filled.map((l) => ({ description: l.description.trim(), quantity: Math.max(1, Math.round(Number(l.quantity) || 1)), amount: Number(l.amount) })),
      insuranceStatus: ins,
      ...(ins === "paid" ? { insurancePaid: Number(insPaid) } : {}),
      ...(balance ? { balanceShown: Number(balance) } : {}),
      ...(Number(oop) > 0 ? { outOfPocketMax: Number(oop) } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      ...(initial.thumb ? { thumb: initial.thumb } : {}),
      savedAt: Date.now(),
    });
  };

  return (
    <>
      <h2 style={{ margin: "0 0 4px" }}>{f ? "Check what we read" : "Add a bill"}</h2>
      {initial.thumb && <img className="bigthumb" src={initial.thumb} alt="Your bill photo" />}
      {f && f.lines.length > 0 && <div className="ok">We read this from your photo. Please check each line and fix anything that is wrong before saving.</div>}
      {initial.note && <div className="notice">{initial.note}</div>}
      {!f && <div className="notice"><b>Fictional data only.</b> Do not type real names, diagnoses or account numbers.</div>}
      {err && <div className="err">{err}</div>}

      <label className="field">Hospital or clinic
        <input className="inp" value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="e.g. Lakeside Medical Center" maxLength={80} />
      </label>
      <div className="two">
        <label className="field">Visit date
          <input className="inp" type="date" value={dos} onChange={(e) => setDos(e.target.value)} />
        </label>
        <label className="field">Went home (optional)
          <input className="inp" type="date" value={dis} onChange={(e) => setDis(e.target.value)} />
        </label>
      </div>

      <div className="field" style={{ marginBottom: 6 }}>Charges on the bill</div>
      {lines.map((l, i) => (
        <div key={i} className="chargeRow">
          <input className="inp" style={{ flex: 1, minWidth: 0 }} value={l.description} onChange={(e) => setLine(i, "description", e.target.value)} placeholder="e.g. CT scan" maxLength={80} aria-label={`Charge ${i + 1} description`} />
          <input className="inp" style={{ width: 52 }} inputMode="numeric" value={l.quantity} onChange={(e) => setLine(i, "quantity", e.target.value)} aria-label={`Charge ${i + 1} quantity`} title="Quantity (for example nights)" />
          <input className="inp" style={{ width: 92 }} inputMode="decimal" value={l.amount} onChange={(e) => setLine(i, "amount", e.target.value.replace(/[^0-9.]/g, ""))} placeholder="$ total" aria-label={`Charge ${i + 1} amount`} />
        </div>
      ))}
      <div className="muted" style={{ marginBottom: 6 }}>Quantity is for things like hospital nights. The amount is the line total.</div>
      <button className="btn sm ghost" type="button" onClick={() => setLines((ls) => [...ls, { description: "", quantity: "1", amount: "" }])} disabled={lines.length >= 20}>+ Add a charge</button>
      <div className="row" style={{ margin: "12px 0" }}><b>Total</b><b className="amt">{usd(total, 2)}</b></div>

      <label className="field">What happened with insurance?
        <select className="inp" value={ins} onChange={(e) => setIns(e.target.value as CustomInput["insuranceStatus"])}>
          <option value="not_sent">The bill was never sent to insurance</option>
          <option value="paid">Insurance paid part of it</option>
          <option value="denied">Insurance denied it (prior authorization)</option>
          <option value="none">I have no insurance</option>
        </select>
      </label>
      {ins === "paid" && (
        <label className="field">How much did insurance pay?
          <input className="inp" inputMode="decimal" value={insPaid} onChange={(e) => setInsPaid(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="$" />
        </label>
      )}
      <label className="field">Amount the bill asks you to pay (optional)
        <input className="inp" inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="Leave empty if the same as total minus insurance" />
      </label>
      <label className="field">Yearly out-of-pocket maximum (optional)
        <input className="inp" inputMode="decimal" value={oop} onChange={(e) => setOop(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="$ from your plan" />
      </label>
      <label className="field">Notes (optional)
        <textarea className="inp" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} placeholder="Anything the bill says that may matter" />
      </label>

      <button className="btn" onClick={submit}>Save on this phone</button>
      <button className="btn ghost" style={{ marginTop: 10 }} onClick={onCancel}>Cancel</button>
    </>
  );
}
