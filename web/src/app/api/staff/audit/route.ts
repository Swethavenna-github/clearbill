import { needStaff } from "@/lib/staff";
import { logAudit, readAudit } from "@/lib/audit-log";

// Only the admin can read the audit log, and reading it is itself logged.
export async function GET(req: Request) {
  const s = needStaff(req, ["admin"]);
  if (s instanceof Response) return s;
  logAudit(s, "viewed audit log");
  return Response.json({ entries: readAudit() });
}
