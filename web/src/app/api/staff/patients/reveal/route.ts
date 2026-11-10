import { needStaff } from "@/lib/staff";
import { logAudit } from "@/lib/audit-log";
import { findById } from "@/lib/registry";
import { formatPhone, initialsOf } from "@/lib/mask";

// Showing a patient's full name and number is a deliberate step, and it is always logged.
export async function POST(req: Request) {
  const s = needStaff(req);
  if (s instanceof Response) return s;
  const { id } = (await req.json()) as { id?: string };
  const p = id ? findById(id) : undefined;
  if (!p) return Response.json({ error: "Patient not found." }, { status: 404 });
  logAudit(s, "revealed full patient details", initialsOf(p.name));
  return Response.json({ name: p.name, phone: formatPhone(p.phone) });
}
