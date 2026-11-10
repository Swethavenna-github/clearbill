import { publicBill, listBillsForUser, resolveBill } from "@/lib/bills";
import { auditBill, correctedCharges, estimateShare } from "@/lib/audit";
import { explainLine } from "@/lib/explain";
import { aiReview } from "@/lib/ai";
import { llmConfigured } from "@/lib/llm";

// GET /api/audit             -> health check
// GET /api/audit?user=ethan  -> that registered patient's bills from their clinic
export async function GET(req: Request) {
  const user = new URL(req.url).searchParams.get("user");
  if (user) return Response.json({ bills: listBillsForUser(user) });
  return Response.json({ ok: true });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { bill, error } = resolveBill(body);
  if (!bill) return Response.json({ error }, { status: 400 });

  const ruleFindings = auditBill(bill).map((f) => ({ ...f, source: "rules" as const }));
  const corrected = correctedCharges(bill, ruleFindings);
  const share = estimateShare(bill, ruleFindings);
  const lines = bill.line_items.map((l) => ({ ...l, plain: explainLine(l.internal_code, l.description) }));

  // AI second opinion: plain-language summary, questions to ask, and up to two extra flags.
  const review = await aiReview(bill, ruleFindings);

  return Response.json({
    bill: publicBill(bill),
    lines,
    findings: [...ruleFindings, ...(review?.extra ?? [])],
    correctedCharges: corrected,
    estimatedShare: share,
    ai: review ? { summary: review.summary, questions: review.questions } : null,
    aiEnabled: llmConfigured(),
  });
}
