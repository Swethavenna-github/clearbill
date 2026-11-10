import { needStaff } from "@/lib/staff";
import { logAudit } from "@/lib/audit-log";
import { decideRequest, listRequests } from "@/lib/registry";
import { getBill, listTemplates, TEMPLATE_IDS } from "@/lib/bills";
import { maskName, maskPhone } from "@/lib/mask";

// Registration requests that patients sent from the app. Staff approve (which registers the number) or decline.
export async function GET(req: Request) {
  const s = needStaff(req);
  if (s instanceof Response) return s;
  const rows = listRequests().map((r) => ({
    id: r.id,
    name: maskName(r.name),
    phone: maskPhone(r.phone),
    status: r.status,
    createdAt: r.createdAt,
    decidedBy: r.decidedBy ?? null,
  }));
  return Response.json({ requests: rows, templates: listTemplates() });
}

export async function POST(req: Request) {
  const s = needStaff(req);
  if (s instanceof Response) return s;
  const { id, decision, templateBillId } = (await req.json()) as { id?: string; decision?: string; templateBillId?: string };
  if (!id || (decision !== "approved" && decision !== "declined")) return Response.json({ error: "Bad request." }, { status: 400 });
  const template = templateBillId && TEMPLATE_IDS.includes(templateBillId) ? getBill(templateBillId) : undefined;
  const r = decideRequest(id, decision, s.name, template);
  if (!r.request) return Response.json({ error: r.error }, { status: 400 });
  logAudit(s, decision === "approved" ? "approved a registration request" : "declined a registration request");
  return Response.json({ ok: true });
}
