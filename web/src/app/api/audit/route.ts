import { getBill, publicBill, listBills } from "@/lib/bills";
import { auditBill, correctedCharges, estimateShare } from "@/lib/audit";
import { explainLine } from "@/lib/explain";
import { aiReview } from "@/lib/ai";
import { llmConfigured } from "@/lib/llm";

export async function GET() {
  return Response.json({ bills: listBills() });
}

export async function POST(req: Request) {
  const { billId } = (await req.json()) as { billId: string };
  const bill = getBill(billId);
  if (!bill) return Response.json({ error: "Unknown bill" }, { status: 404 });

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
