"use client";

import { useState } from "react";

export default function StaffLogin() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [demoCode, setDemoCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const post = async (url: string, body: unknown) => {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Something went wrong");
    return data;
  };

  const sendCode = async () => {
    setBusy(true);
    setErr("");
    try {
      if (phone.replace(/\D/g, "").length < 9) throw new Error("Enter your staff phone number.");
      const d = await post("/api/staff/login", { phone });
      setDemoCode(d.demoCode || "");
      setStep("code");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    setErr("");
    try {
      await post("/api/staff/verify", { phone, code });
      window.location.href = "/clinic";
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="dash" style={{ maxWidth: 460, paddingTop: 60 }}>
      <div className="panel">
        <span className="tag" style={{ background: "var(--purple)", color: "#fff", padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>Clearbill</span>
        <h1 style={{ margin: "12px 0 4px", fontSize: 24 }}>Clinic staff sign-in</h1>
        <p className="muted" style={{ marginTop: 0 }}>Riverbend Community Hospital. For authorized staff only. Your actions are recorded in an audit log.</p>
        {err && <div className="err">{err}</div>}

        {step === "phone" && (
          <>
            <label className="field">Staff mobile number
              <span className="phoneRow">
                <span className="prefix" aria-hidden="true">🇺🇸 +1</span>
                <input className="inp phoneInp" type="tel" inputMode="tel" autoComplete="off" placeholder="987 654 321" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d\s()-]/g, "").slice(0, 16))} onKeyDown={(e) => e.key === "Enter" && sendCode()} aria-label="Staff mobile number" />
              </span>
            </label>
            <button className="btn" disabled={busy} onClick={sendCode}>{busy ? "Sending..." : "Send code"}</button>
            <div className="notice" style={{ marginTop: 14 }}>
              <b>Demo staff numbers:</b> 987 654 321 (billing admin) or 987 654 322 (front desk).
            </div>
          </>
        )}

        {step === "code" && (
          <>
            <div className="ok">
              {demoCode ? <>Demo mode: no text message is sent. Your code is <b>{demoCode}</b>.</> : <>If that number belongs to staff, a code was sent.</>}
            </div>
            <label className="field">One-time code
              <input className="inp" inputMode="numeric" autoComplete="one-time-code" placeholder="6 digits" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} onKeyDown={(e) => e.key === "Enter" && verify()} aria-label="One-time code" />
            </label>
            <button className="btn" disabled={busy || code.length < 6} onClick={verify}>{busy ? "Checking..." : "Sign in"}</button>
            <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => { setStep("phone"); setCode(""); setErr(""); }}>Use a different number</button>
          </>
        )}
        <div className="muted" style={{ marginTop: 14, fontSize: 12 }}>Sessions end automatically after 20 minutes, or after 10 minutes without activity. Five wrong codes lock the number for 5 minutes.</div>
      </div>
    </div>
  );
}
