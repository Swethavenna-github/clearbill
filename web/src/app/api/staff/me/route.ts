import { needStaff, SESSION_SECONDS } from "@/lib/staff";

export async function GET(req: Request) {
  const s = needStaff(req);
  if (s instanceof Response) return s;
  return Response.json({ staff: { name: s.name, role: s.role }, sessionSeconds: SESSION_SECONDS });
}
