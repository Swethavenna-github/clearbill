import { llmConfigured, llmJSON } from "@/lib/llm";

// POST /api/scan { image: "data:image/jpeg;base64,..." }
// Reads a photo of a (fictional) bill with the AI model and returns fields to pre-fill the "Add a bill" form.
// The photo is not stored on the server. The person checks and corrects the fields before saving.
type Raw = {
  provider?: string;
  dateOfService?: string;
  dischargeDate?: string;
  lines?: { description?: string; quantity?: number; amount?: number }[];
  insuranceStatus?: string;
  insurancePaid?: number;
  balanceShown?: number;
  notes?: string;
};

const clip = (s: unknown, n: number) => String(s ?? "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, n);
const date = (s: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s ?? "")) ? String(s) : "");
const amount = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && n < 1_000_000 ? Math.round(n * 100) / 100 : 0;
};

export async function POST(req: Request) {
  const { image } = (await req.json()) as { image?: string };
  const m = String(image || "").match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return Response.json({ error: "Please choose a photo (JPEG or PNG)." }, { status: 400 });
  if (m[2].length > 3_500_000) return Response.json({ error: "That photo is too large. Try a smaller one." }, { status: 413 });
  if (!llmConfigured()) return Response.json({ scanned: false, reason: "AI reading is switched off, so please type the bill in." });

  const out = await llmJSON<Raw>(
    `This is a photo of a fictional medical bill. Read it and return JSON with exactly these keys:\n` +
      `- "provider": the hospital or clinic name\n` +
      `- "dateOfService": YYYY-MM-DD, or "" if not visible\n` +
      `- "dischargeDate": YYYY-MM-DD, or "" if not shown\n` +
      `- "lines": array (max 20) of {"description": short text, "quantity": integer (1 if not shown), "amount": the line total in dollars as a number}\n` +
      `- "insuranceStatus": "paid" if an insurance payment is shown, "denied" if a claim denial is shown, "not_sent" if nothing was billed to insurance, "none" if the patient has no insurance, otherwise "not_sent"\n` +
      `- "insurancePaid": dollars insurance paid, or 0\n` +
      `- "balanceShown": the amount the bill asks the patient to pay, or 0\n` +
      `- "notes": one short sentence of anything important, or ""\n` +
      `Rules: never guess a value that is not visible. Do not copy personal identifiers (names of people, addresses, phone, account or insurance member numbers) into any field.`,
    {
      system: "You read bills accurately and return JSON only.",
      image: { mime: m[1], data: m[2] },
      timeoutMs: 40000,
      temperature: 0,
    },
  );
  if (!out) return Response.json({ scanned: false, reason: "We could not read that photo. Please try again in better light, or type the bill in." });

  const lines = (Array.isArray(out.lines) ? out.lines : [])
    .slice(0, 20)
    .map((l) => ({ description: clip(l?.description, 80), quantity: Math.min(60, Math.max(1, Math.round(Number(l?.quantity) || 1))), amount: amount(l?.amount) }))
    .filter((l) => l.description && l.amount > 0);
  const status = ["paid", "denied", "not_sent", "none"].includes(String(out.insuranceStatus)) ? String(out.insuranceStatus) : "not_sent";
  const paid = amount(out.insurancePaid);

  return Response.json({
    scanned: true,
    fields: {
      provider: clip(out.provider, 80),
      dateOfService: date(out.dateOfService),
      dischargeDate: date(out.dischargeDate),
      lines,
      insuranceStatus: status === "paid" && !paid ? "not_sent" : status,
      insurancePaid: paid,
      balanceShown: amount(out.balanceShown),
      notes: clip(out.notes, 200),
    },
  });
}
