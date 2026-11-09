// Thin PayPal REST client (sandbox by default). Keys come from environment variables only.
const BASE = process.env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

export class PayPalNotConfigured extends Error {}

export function paypalConfigured() {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

let cached: { token: string; exp: number } | null = null;

async function token() {
  if (!paypalConfigured()) throw new PayPalNotConfigured("PayPal sandbox keys are not set yet.");
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const basic = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal sign-in failed (${res.status}). Check the sandbox Client ID and Secret.`);
  const data = await res.json();
  cached = { token: data.access_token, exp: Date.now() + data.expires_in * 1000 };
  return cached.token;
}

async function pp<T = any>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const t = await token();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${t}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers || {}),
    },
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  });
  const text = await res.text();
  let data: any = text;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    /* keep text */
  }
  if (!res.ok) {
    const msg = data?.message || data?.name || text.slice(0, 200);
    const details = Array.isArray(data?.details) ? data.details.map((d: any) => d.issue || d.description).join("; ") : "";
    throw new Error(`PayPal ${path} failed (${res.status}): ${msg}${details ? " - " + details : ""}`);
  }
  return data as T;
}

const fix2 = (n: number) => n.toFixed(2);
const today = () => new Date().toISOString().slice(0, 10);

export async function createInvoice(opts: {
  clinicName: string;
  clinicEmail?: string;
  patientFirst: string;
  patientLast: string;
  patientEmail: string;
  itemName: string;
  itemDescription: string;
  amount: number;
  note: string;
}) {
  const num = await pp<{ invoice_number: string }>("/v2/invoicing/generate-next-invoice-number", { method: "POST" });
  const created = await pp<any>("/v2/invoicing/invoices", {
    method: "POST",
    json: {
      detail: {
        invoice_number: num.invoice_number,
        invoice_date: today(),
        currency_code: "USD",
        note: opts.note,
        payment_term: { term_type: "NET_30" },
      },
      invoicer: {
        name: { business_name: opts.clinicName },
        ...(opts.clinicEmail ? { email_address: opts.clinicEmail } : {}),
      },
      primary_recipients: [
        {
          billing_info: {
            name: { given_name: opts.patientFirst, surname: opts.patientLast },
            email_address: opts.patientEmail,
          },
        },
      ],
      items: [
        {
          name: opts.itemName,
          description: opts.itemDescription,
          quantity: "1",
          unit_amount: { currency_code: "USD", value: fix2(opts.amount) },
        },
      ],
    },
  });
  const href: string = created.href || created.links?.find((l: any) => l.rel === "self")?.href || "";
  const id = created.id || href.split("/").pop();
  await pp(`/v2/invoicing/invoices/${id}/send`, { method: "POST", json: { send_to_recipient: true, send_to_invoicer: false } });
  const full = await pp<any>(`/v2/invoicing/invoices/${id}`, { method: "GET" });
  let qr: string | null = null;
  try {
    const t = await token();
    const r = await fetch(`${BASE}/v2/invoicing/invoices/${id}/generate-qr-code`, {
      method: "POST",
      headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      body: JSON.stringify({ width: 300, height: 300 }),
    });
    if (r.ok) {
      const body = await r.text();
      // PayPal answers with a multipart body whose text part holds the PNG as base64
      const part = body.match(/\r?\n\r?\n([A-Za-z0-9+/=\r\n]+)\r?\n--/);
      const raw = part ? part[1] : /^[A-Za-z0-9+/=\s]+$/.test(body) ? body : "";
      qr = raw ? raw.replace(/\s/g, "") : null;
    }
  } catch {
    /* QR is optional */
  }
  return {
    id,
    number: num.invoice_number,
    status: full.status,
    viewUrl: full.detail?.metadata?.recipient_view_url || full.detail?.metadata?.invoicer_view_url || null,
    qrBase64: qr,
  };
}

export async function createInstallmentPlan(opts: {
  planName: string;
  monthly: number;
  fullCycles: number;
  lastPayment: number;
  patientFirst: string;
  patientLast: string;
  patientEmail: string;
  returnUrl: string;
  cancelUrl: string;
}) {
  const product = await pp<any>("/v1/catalogs/products", {
    method: "POST",
    json: { name: "Medical bill payment plan", description: "Installment plan for a medical bill (demo)", type: "SERVICE" },
  });
  const cycles: any[] = [];
  if (opts.fullCycles > 0) {
    cycles.push({
      frequency: { interval_unit: "MONTH", interval_count: 1 },
      tenure_type: "REGULAR",
      sequence: 1,
      total_cycles: opts.fullCycles,
      pricing_scheme: { fixed_price: { value: fix2(opts.monthly), currency_code: "USD" } },
    });
  }
  if (opts.lastPayment > 0.005 && Math.abs(opts.lastPayment - opts.monthly) > 0.005) {
    cycles.push({
      frequency: { interval_unit: "MONTH", interval_count: 1 },
      tenure_type: "REGULAR",
      sequence: cycles.length + 1,
      total_cycles: 1,
      pricing_scheme: { fixed_price: { value: fix2(opts.lastPayment), currency_code: "USD" } },
    });
  }
  const plan = await pp<any>("/v1/billing/plans", {
    method: "POST",
    json: {
      product_id: product.id,
      name: opts.planName,
      description: opts.planName,
      status: "ACTIVE",
      billing_cycles: cycles,
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee: { value: "0", currency_code: "USD" },
        setup_fee_failure_action: "CONTINUE",
        payment_failure_threshold: 3,
      },
    },
  });
  const sub = await pp<any>("/v1/billing/subscriptions", {
    method: "POST",
    json: {
      plan_id: plan.id,
      subscriber: {
        name: { given_name: opts.patientFirst, surname: opts.patientLast },
        email_address: opts.patientEmail,
      },
      application_context: {
        brand_name: "Clearbill demo",
        locale: "en-US",
        shipping_preference: "NO_SHIPPING",
        user_action: "SUBSCRIBE_NOW",
        return_url: opts.returnUrl,
        cancel_url: opts.cancelUrl,
      },
    },
  });
  const approve = sub.links?.find((l: any) => l.rel === "approve")?.href as string | undefined;
  return { productId: product.id, planId: plan.id, subscriptionId: sub.id as string, status: sub.status as string, approveUrl: approve || null };
}

export async function getSubscription(id: string) {
  const s = await pp<any>(`/v1/billing/subscriptions/${encodeURIComponent(id)}`, { method: "GET" });
  return {
    id: s.id as string,
    status: s.status as string,
    planId: s.plan_id as string,
    nextBilling: (s.billing_info?.next_billing_time as string | undefined) || null,
    lastPayment: s.billing_info?.last_payment?.amount?.value as string | undefined,
  };
}
