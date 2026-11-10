import { checkLock, findStaff, makeCookie, verifyCode } from "@/lib/staff";
import { logAudit } from "@/lib/audit-log";

export async function POST(req: Request) {
  const { phone, code } = (await req.json()) as { phone?: string; code?: string };
  const locked = checkLock(phone || "");
  if (locked) return Response.json({ error: `Too many wrong codes. Try again in ${Math.ceil(locked / 60)} minutes.` }, { status: 429 });
  const staff = findStaff(phone || "");
  if (!staff || !verifyCode(phone || "", code || "")) {
    if (staff) logAudit(staff, "sign-in failed", "wrong code");
    return Response.json({ error: "That number or code is not right." }, { status: 401 });
  }
  logAudit(staff, "signed in");
  const secure = req.headers.get("x-forwarded-proto") === "https";
  return new Response(JSON.stringify({ staff: { name: staff.name, role: staff.role } }), {
    headers: { "Content-Type": "application/json", "Set-Cookie": makeCookie(staff, secure) },
  });
}
