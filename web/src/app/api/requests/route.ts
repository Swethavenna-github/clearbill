import { createRequest } from "@/lib/registry";

// Public: a person asks the clinic to register their phone number. It waits for staff approval.
const gl = globalThis as unknown as { __cbReqHits?: Map<string, number[]> };
const hits: Map<string, number[]> = (gl.__cbReqHits ??= new Map<string, number[]>());

export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") || "local").split(",")[0].trim();
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 3_600_000);
  if (recent.length >= 10) return Response.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  hits.set(ip, [...recent, now]);

  const { name, phone } = (await req.json()) as { name?: string; phone?: string };
  const r = createRequest({ name: name || "", phone: phone || "" });
  // The same reply for "already registered" and "already waiting", so this form cannot be used to check who is registered.
  if (r.error && !/already/i.test(r.error)) return Response.json({ error: r.error }, { status: 400 });
  return Response.json({ ok: true });
}
