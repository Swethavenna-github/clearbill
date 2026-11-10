import type { Bill, Finding } from "./types";
import { llmConfigured, llmJSON, llmText } from "./llm";

export type AiReview = { summary: string; questions: string[]; extra: Finding[] };

const SAFETY =
  "You are a billing helper, not a doctor or lawyer. Never give medical or legal advice. Use cautious wording such as 'ask' and 'may'. Never invent facts, names or numbers that are not in the data.";

// Second opinion on the bill. The rules already found the main problems; the AI explains them
// in plain words and may raise at most two extra questions about specific lines.
export async function aiReview(bill: Bill, findings: Finding[]): Promise<AiReview | null> {
  if (!llmConfigured()) return null;
  const view = {
    patient: { age: bill.patient.age, insurance: bill.patient.insurance },
    provider: bill.provider.name,
    visit: { date_of_service: bill.date_of_service, discharge_date: bill.discharge_date },
    lines: bill.line_items.map((l) => ({ line: l.line, description: l.description, qty: l.quantity, charge: l.charge })),
    total_charges: bill.total_charges,
    insurance: bill.insurance,
    notes: bill.bill_notes,
    problems_already_found_by_rules: findings.map((f) => ({ title: f.title, lines: f.lines, why: f.explain })),
  };
  const out = await llmJSON<{
    summary?: string;
    questions?: string[];
    extra_flags?: { lines?: number[]; title?: string; explain?: string; fix?: string }[];
  }>(
    `Here is a fictional medical bill as JSON:\n${JSON.stringify(view)}\n\nReturn JSON with:\n` +
      `- "summary": 3 short sentences in plain English for the patient: what happened, what the bill is, and the main things worth questioning. Mention the problems already found.\n` +
      `- "questions": up to 4 short, specific questions the patient could ask the hospital or insurer.\n` +
      `- "extra_flags": at most 2 additional suspicious lines NOT already covered, each {"lines":[line numbers that exist],"title","explain","fix"}. Use an empty array if nothing else looks wrong. Do not flag normal charges.`,
    { system: SAFETY, timeoutMs: 20000 },
  );
  if (!out || typeof out.summary !== "string") return null;

  const valid = new Set(bill.line_items.map((l) => l.line));
  const covered = new Set(findings.flatMap((f) => f.lines));
  const extra: Finding[] = (out.extra_flags || [])
    .filter((f) => f && Array.isArray(f.lines) && f.lines.length > 0 && f.lines.every((n) => valid.has(n)) && !f.lines.every((n) => covered.has(n)) && f.title && f.explain)
    .slice(0, 2)
    .map((f, i) => ({
      id: `ai-${i}`,
      type: "ai_second_opinion",
      title: String(f.title).slice(0, 80),
      lines: f.lines as number[],
      confidence: "medium" as const,
      explain: String(f.explain).slice(0, 320),
      fix: String(f.fix || "Ask the hospital to explain this charge.").slice(0, 240),
      savings: null,
      source: "ai" as const,
    }));

  return {
    summary: out.summary.slice(0, 600),
    questions: (out.questions || []).filter((q) => typeof q === "string").slice(0, 4).map((q) => q.slice(0, 200)),
    extra,
  };
}

// The agents: the rules decide the numbers, the AI writes what each agent says.
// If the AI changes or drops any dollar figure, we fall back to the plain message.
export async function agentMessage(role: "patient" | "clinic", facts: string, fallback: string): Promise<string> {
  if (!llmConfigured()) return fallback;
  const persona =
    role === "patient"
      ? "You are the billing agent working for a patient. You are warm, clear and protective of the patient's budget."
      : "You are the billing agent for a hospital. You are professional, fair and follow the hospital's payment-plan rules exactly.";
  const audience = role === "patient" ? "the hospital's billing agent" : "the patient's billing agent";
  const text = await llmText(
    `${facts}\n\nYou are writing a message to ${audience}, not to the patient. ${role === "patient" ? 'Speak for the patient: say "my patient" or use his or her first name.' : 'Speak as the hospital: say "we" and "the hospital"; never say "my patient".'} The decision is already made and you must not change it. Do not add any policy, promise, deadline or condition that is not in the draft. Say it in your own words in 2 sentences at most. Keep these dollar amounts exactly: ${(fallback.match(/\$[\d,]+/g) || []).join(", ") || "none"}. Plain text only.\nDraft to improve: ${fallback}`,
    { system: `${persona} ${SAFETY}`, timeoutMs: 12000, temperature: 0.6 },
  );
  if (!text) return fallback;
  const clean = text.replace(/\s+/g, " ").trim();
  const need = fallback.match(/\$[\d,]+/g) || [];
  if (!need.every((n) => clean.includes(n)) || clean.length > 400) return fallback;
  return clean;
}

// ---------------- dashboard "ask" box ----------------
export type PlanRow = { initials: string; plan: string; balance: number; monthly: number; nextPayment: string; status: string; ageDays: number };
type Query = {
  status?: string;
  minBalance?: number;
  maxBalance?: number;
  minAgeDays?: number;
  maxAgeDays?: number;
  sortBy?: "balance" | "monthly" | "ageDays";
  sortDir?: "asc" | "desc";
  limit?: number;
};

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

function keywordQuery(q: string): Query {
  const s = q.toLowerCase();
  const out: Query = {};
  if (/\blate|overdue|behind\b/.test(s)) out.status = "Late";
  else if (/on track|current/.test(s)) out.status = "On track";
  else if (/\bnew\b/.test(s)) out.status = "New";
  const over = s.match(/(?:over|above|more than|greater than)\s*\$?([\d,]+)/);
  if (over) out.minBalance = Number(over[1].replace(/,/g, ""));
  const under = s.match(/(?:under|below|less than)\s*\$?([\d,]+)/);
  if (under) out.maxBalance = Number(under[1].replace(/,/g, ""));
  const days = s.match(/(?:older than|over|more than)\s*(\d+)\s*days/);
  if (days) out.minAgeDays = Number(days[1]);
  if (/oldest|longest|most overdue|most late/.test(s)) Object.assign(out, { sortBy: "ageDays", sortDir: "desc" });
  if (/biggest|largest|highest/.test(s)) Object.assign(out, { sortBy: "balance", sortDir: "desc" });
  return out;
}

export async function askDashboard(question: string, plans: PlanRow[]) {
  let query: Query | null = null;
  let usedAI = false;
  if (llmConfigured()) {
    query = await llmJSON<Query>(
      `A clinic billing manager asks: "${question.slice(0, 300)}"\nTurn it into a filter over a table of payment plans with columns: initials, balance (dollars), monthly (dollars), status (one of "On track","Late","New"), ageDays (how many days past due the plan is; 0 means up to date).\nReturn JSON with only these optional keys: status, minBalance, maxBalance, minAgeDays, maxAgeDays, sortBy ("balance"|"monthly"|"ageDays"), sortDir ("asc"|"desc"), limit (1-20). Use {} if the question does not map to the table.`,
      { system: "You translate questions into table filters. Output JSON only.", timeoutMs: 12000, temperature: 0 },
    );
    usedAI = Boolean(query);
  }
  if (!query) query = keywordQuery(question);

  const q: Query = {
    status: ["On track", "Late", "New"].includes(query.status || "") ? query.status : undefined,
    minBalance: Number.isFinite(query.minBalance) ? query.minBalance : undefined,
    maxBalance: Number.isFinite(query.maxBalance) ? query.maxBalance : undefined,
    minAgeDays: Number.isFinite(query.minAgeDays) ? query.minAgeDays : undefined,
    maxAgeDays: Number.isFinite(query.maxAgeDays) ? query.maxAgeDays : undefined,
    sortBy: ["balance", "monthly", "ageDays"].includes(query.sortBy || "") ? query.sortBy : undefined,
    sortDir: query.sortDir === "asc" ? "asc" : "desc",
    limit: Math.min(20, Math.max(1, Math.round(Number(query.limit) || 20))),
  };

  let rows = plans.filter(
    (p) =>
      (!q.status || p.status === q.status) &&
      (q.minBalance === undefined || p.balance >= q.minBalance) &&
      (q.maxBalance === undefined || p.balance <= q.maxBalance) &&
      (q.minAgeDays === undefined || p.ageDays >= q.minAgeDays) &&
      (q.maxAgeDays === undefined || p.ageDays <= q.maxAgeDays),
  );
  if (q.sortBy) {
    const k = q.sortBy;
    rows = [...rows].sort((a, b) => (q.sortDir === "asc" ? a[k] - b[k] : b[k] - a[k]));
  }
  rows = rows.slice(0, q.limit);

  const total = rows.reduce((s, r) => s + r.balance, 0);
  const parts = [q.status && `status ${q.status}`, q.minBalance !== undefined && `balance over ${usd(q.minBalance)}`, q.maxBalance !== undefined && `balance under ${usd(q.maxBalance)}`, q.minAgeDays !== undefined && `more than ${q.minAgeDays} days past due`].filter(Boolean);
  // Numbers in the answer are computed here, never written by the AI.
  const answer = rows.length
    ? `${rows.length} plan${rows.length > 1 ? "s" : ""}${parts.length ? " with " + parts.join(", ") : ""}, ${usd(total)} outstanding in total.`
    : `No plans match${parts.length ? " " + parts.join(", ") : ""}.`;
  return { answer, rows, usedAI, query: q };
}
