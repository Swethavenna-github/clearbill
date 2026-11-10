import { clearCookie, sessionFrom } from "@/lib/staff";
import { logAudit } from "@/lib/audit-log";

export async function POST(req: Request) {
  const s = sessionFrom(req);
  if (s) logAudit(s, "signed out");
  return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json", "Set-Cookie": clearCookie() } });
}
