import type { DashboardData } from "./dashboard-data";

// Fictional history for the billing analytics page, added on top of the live PayPal sandbox data so the charts
// have enough to show: six months of invoices, payments, fees, refunds, payouts and payment plans for the clinic's
// patients. Real sandbox rows are kept; sample ids start with "SAMPLE-". Nothing here is sent to PayPal.
const r2 = (n: number) => Math.round(n * 100) / 100;
const DAY = 86_400_000;

type Item = [name: string, unit: string, qty: number, price: number];
type Spec = { cust: string; ago: number; items: Item[]; paid: number; refund?: number; method: string; payAfter: number; tax?: number };

const CUSTOMERS = [
  { n: "Maria Lopez", co: "Self-pay" },
  { n: "James Okafor", co: "Employer plan" },
  { n: "Priya Raman", co: "Employer plan" },
  { n: "Daniel Brooks", co: "Self-pay" },
  { n: "Aisha Khan", co: "Medicare" },
  { n: "Elena Petrova", co: "Employer plan" },
  { n: "Tom Nguyen", co: "Self-pay" },
  { n: "Rosa Martinez", co: "Medicaid" },
  { n: "Sam Walker", co: "Self-pay" },
  { n: "Ethan Cole", co: "Self-pay" },
].map((c) => ({ ...c, id: `${c.n.toLowerCase().replace(/ /g, ".")}@patients.example.com` }));
const cid = (i: number) => CUSTOMERS[i].id;

// ago = days since the invoice date. paid = amount received so far.
const SPECS: Spec[] = [
  { cust: cid(0), ago: 168, items: [["Emergency room visit", "Visit", 1, 2400], ["CT scan", "Scan", 1, 980]], paid: 3380, method: "Credit card", payAfter: 9 },
  { cust: cid(1), ago: 160, items: [["Orthopedic consult", "Visit", 1, 320], ["X-ray", "Scan", 2, 70]], paid: 460, method: "PayPal", payAfter: 5 },
  { cust: cid(2), ago: 150, items: [["Primary care visit", "Visit", 1, 180], ["Lab work", "Test", 3, 85]], paid: 435, method: "Credit card", payAfter: 12 },
  { cust: cid(3), ago: 141, items: [["MRI scan", "Scan", 1, 1890], ["Specialist consult", "Visit", 1, 260]], paid: 2150, method: "Bank transfer", payAfter: 20 },
  { cust: cid(4), ago: 133, items: [["Hospital stay", "Day", 3, 4200], ["Surgery", "Procedure", 1, 5400]], paid: 12000, method: "Bank transfer", payAfter: 34 },
  { cust: cid(5), ago: 126, items: [["Diabetes follow-up", "Visit", 1, 210], ["Lab work", "Test", 2, 85]], paid: 380, method: "PayPal", payAfter: 6 },
  { cust: cid(6), ago: 118, items: [["Physical therapy", "Session", 6, 95]], paid: 570, method: "Credit card", payAfter: 14 },
  { cust: cid(7), ago: 110, items: [["Emergency room visit", "Visit", 1, 2400], ["Lab work", "Test", 4, 85]], paid: 1500, method: "Credit card", payAfter: 8 },
  { cust: cid(8), ago: 104, items: [["Hospital stay", "Day", 2, 4200]], paid: 8400, method: "Bank transfer", payAfter: 27 },
  { cust: cid(9), ago: 98, items: [["Orthopedic consult", "Visit", 1, 320], ["MRI scan", "Scan", 1, 1890]], paid: 2210, method: "Credit card", payAfter: 11 },
  { cust: cid(0), ago: 91, items: [["Follow-up visit", "Visit", 1, 150]], paid: 150, method: "PayPal", payAfter: 3 },
  { cust: cid(2), ago: 84, items: [["Physical therapy", "Session", 4, 95], ["X-ray", "Scan", 1, 70]], paid: 450, method: "Credit card", payAfter: 10 },
  { cust: cid(3), ago: 77, items: [["Back MRI", "Scan", 1, 1890]], paid: 1890, refund: 410, method: "Credit card", payAfter: 13 },
  { cust: cid(4), ago: 70, items: [["Appendectomy", "Procedure", 1, 9800], ["Hospital stay", "Day", 2, 4200]], paid: 12000, method: "Bank transfer", payAfter: 30 },
  { cust: cid(5), ago: 63, items: [["Primary care visit", "Visit", 1, 180]], paid: 180, method: "PayPal", payAfter: 4 },
  { cust: cid(1), ago: 56, items: [["Ankle sprain visit", "Visit", 1, 360], ["X-ray", "Scan", 2, 70]], paid: 500, method: "Credit card", payAfter: 16 },
  { cust: cid(6), ago: 49, items: [["Physical therapy", "Session", 8, 95], ["Specialist consult", "Visit", 1, 260]], paid: 600, method: "Credit card", payAfter: 18 },
  { cust: cid(7), ago: 42, items: [["Hospital stay", "Day", 1, 4200], ["Lab work", "Test", 5, 85]], paid: 2400, method: "Bank transfer", payAfter: 21 },
  { cust: cid(8), ago: 38, items: [["Surgery deposit", "Procedure", 1, 2800]], paid: 1800, method: "Credit card", payAfter: 9 },
  { cust: cid(9), ago: 33, items: [["Physical therapy", "Session", 6, 95], ["Orthopedic consult", "Visit", 1, 320]], paid: 530, method: "PayPal", payAfter: 7 },
  { cust: cid(0), ago: 27, items: [["Lab work", "Test", 4, 85]], paid: 340, method: "Credit card", payAfter: 5 },
  { cust: cid(2), ago: 21, items: [["Routine checkup", "Visit", 1, 445]], paid: 445, method: "PayPal", payAfter: 4 },
  { cust: cid(3), ago: 16, items: [["Specialist consult", "Visit", 1, 260], ["Out-of-network fee", "Fee", 1, 400]], paid: 0, method: "Credit card", payAfter: 0 },
  { cust: cid(4), ago: 12, items: [["Hospital stay", "Day", 2, 4200]], paid: 4000, method: "Bank transfer", payAfter: 6 },
  { cust: cid(5), ago: 9, items: [["Diabetes follow-up", "Visit", 1, 210]], paid: 210, method: "Credit card", payAfter: 2 },
  { cust: cid(6), ago: 6, items: [["Physical therapy", "Session", 4, 95]], paid: 0, method: "Credit card", payAfter: 0 },
  { cust: cid(8), ago: 4, items: [["Hospital stay", "Day", 1, 4200], ["Lab work", "Test", 2, 85]], paid: 0, method: "Bank transfer", payAfter: 0 },
  { cust: cid(1), ago: 3, items: [["Orthopedic consult", "Visit", 1, 320]], paid: 320, method: "PayPal", payAfter: 1 },
  { cust: cid(7), ago: 2, items: [["Follow-up visit", "Visit", 1, 150]], paid: 0, method: "Credit card", payAfter: 0 },
];

const iso = (t: number) => new Date(t).toISOString();
const dateOnly = (t: number) => iso(t).slice(0, 10);

export function withSample(data: DashboardData): DashboardData {
  const asOf = new Date(data.asOf).getTime();
  const today = dateOnly(asOf);

  const invoices: DashboardData["invoices"] = [];
  const invoiceItems: DashboardData["invoiceItems"] = [];
  const invoicePayments: DashboardData["invoicePayments"] = [];
  const transactions: DashboardData["transactions"] = [];

  SPECS.forEach((s, idx) => {
    const id = `SAMPLE-INV-${String(idx + 1).padStart(4, "0")}`;
    const invDate = asOf - s.ago * DAY;
    const dueDate = invDate + 30 * DAY;
    const total = r2(s.items.reduce((t, [, , q, p]) => t + q * p, 0));
    const refunded = s.refund ?? 0;
    const paid = Math.min(s.paid, total);
    const outstanding = r2(total - paid);
    const receivable = outstanding > 0;
    const daysOverdue = receivable ? Math.max(0, Math.round((asOf - dueDate) / DAY)) : 0;
    const status = receivable ? (paid > 0 ? "Partially paid" : "Sent") : refunded > 0 ? "Partially refunded" : "Paid";
    const statusGroup = receivable ? (paid > 0 ? "Partially paid" : "Open") : refunded > 0 ? "Refunded" : "Paid";
    const aging = !receivable ? null : daysOverdue <= 0 ? "0. Not yet due" : daysOverdue <= 30 ? "1. 1-30 days" : daysOverdue <= 60 ? "2. 31-60 days" : daysOverdue <= 90 ? "3. 61-90 days" : "4. 90+ days";
    const payDate = invDate + s.payAfter * DAY;
    invoices.push({
      id, number: `S-${String(idx + 1).padStart(4, "0")}`, customerId: s.cust, status, statusGroup, currency: "USD", paymentTerm: "Net 30",
      invoiceDate: dateOnly(invDate), dueDate: dateOnly(dueDate), total, issuedAmount: total, paidAmount: paid, refundedAmount: refunded,
      netCollected: r2(paid - refunded), isReceivable: receivable, outstanding, overdueAmount: daysOverdue > 0 ? outstanding : 0, daysOverdue,
      agingBucket: aging, daysToPay: paid > 0 ? s.payAfter : null, taxTotal: 0,
    });
    s.items.forEach(([name, unit, quantity, unitPrice], i) => {
      const gross = r2(quantity * unitPrice);
      invoiceItems.push({ id: `${id}-${i + 1}`, invoiceId: id, name, unit, quantity, unitPrice, gross, discount: 0, tax: 0, lineTotal: gross });
    });
    const email = s.cust;
    if (paid > 0) {
      invoicePayments.push({ id: `${id}-pay`, invoiceId: id, kind: "Payment", method: s.method, date: dateOnly(payDate), amount: paid, signedAmount: paid });
      const fee = s.method === "Bank transfer" ? -Math.min(5, r2(paid * 0.008)) : -r2(paid * 0.029 + 0.3);
      transactions.push({ id: `${id}-tx`, date: iso(payDate), eventType: "Payment received", status: "Success", direction: "Credit", currency: "USD", amount: paid, fee, net: r2(paid + fee), endingBalance: null, counterparty: email, note: `Invoice S-${String(idx + 1).padStart(4, "0")}` });
    }
    if (refunded > 0) {
      const rd = payDate + 6 * DAY;
      invoicePayments.push({ id: `${id}-ref`, invoiceId: id, kind: "Refund", method: s.method, date: dateOnly(rd), amount: refunded, signedAmount: -refunded });
      transactions.push({ id: `${id}-rtx`, date: iso(rd), eventType: "Refund", status: "Success", direction: "Debit", currency: "USD", amount: -refunded, fee: 0, net: -refunded, endingBalance: null, counterparty: email, note: "Billing error corrected" });
    }
  });

  // Refund and adjustment payouts the clinic made.
  const payoutSpec: [string, string, number, number][] = [
    ["Refunds", cid(3), 410, 77], ["Insurance adjustments", cid(4), 650, 60], ["Charity care", cid(7), 900, 44],
    ["Refunds", cid(0), 120, 31], ["Insurance adjustments", cid(2), 275, 22], ["Charity care", cid(8), 500, 14], ["Refunds", cid(5), 95, 7],
  ];
  const payouts: DashboardData["payouts"] = payoutSpec.map(([campaign, recipient, amount, ago], i) => ({
    id: `SAMPLE-PAY-${i + 1}`, campaign, recipient, date: iso(asOf - ago * DAY), status: "Success", amount, fee: 0, note: `${campaign} payout`,
  }));
  payouts.forEach((p) =>
    transactions.push({ id: p.id, date: p.date, eventType: "Payout", status: "Success", direction: "Debit", currency: "USD", amount: -p.amount, fee: 0, net: -p.amount, endingBalance: null, counterparty: p.recipient, note: p.note }),
  );

  const customers = CUSTOMERS.map((c) => ({ id: c.id, name: c.n, company: c.co, email: c.id }));
  const products = [{ id: "SAMPLE-PROD-1", name: "Hospital bill payment plans", type: "Service", category: "Healthcare", description: "Monthly installment plans for patients" }];
  const plans = [6, 12, 18, 24].map((m, i) => ({
    id: `SAMPLE-PLAN-${i + 1}`, productId: "SAMPLE-PROD-1", name: `${m}-month plan`, status: "Active", billingInterval: "Every month",
    price: [250, 150, 100, 75][i], monthlyPrice: [250, 150, 100, 75][i], trialDays: 0, setupFee: 0,
  }));
  const balances = [{ currency: "USD", total: 21480.55, available: 20910.1, withheld: 570.45 }];
  void today;

  return {
    ...data,
    customers: [...data.customers, ...customers.filter((c) => !data.customers.some((x) => x.id === c.id))],
    invoices: [...data.invoices, ...invoices],
    invoiceItems: [...data.invoiceItems, ...invoiceItems],
    invoicePayments: [...data.invoicePayments, ...invoicePayments],
    products: [...data.products, ...products],
    plans: [...data.plans, ...plans],
    transactions: [...data.transactions, ...transactions],
    payouts: [...data.payouts, ...payouts],
    balances: data.balances.length ? data.balances : balances,
  } as DashboardData;
}
