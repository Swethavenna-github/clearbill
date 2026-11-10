import { needStaff } from "@/lib/staff";
import { logAudit } from "@/lib/audit-log";
import { findByPhone, listPatients, registerPatient } from "@/lib/registry";
import { getBill, listBillsForUser, listTemplates, TEMPLATE_IDS } from "@/lib/bills";
import { maskName, maskPhone } from "@/lib/mask";

// GET  /api/staff/patients?q=  -> the patient list with names and phone numbers masked
// POST /api/staff/patients     -> register a patient (front desk or admin)
export async function GET(req: Request) {
  const s = needStaff(req);
  if (s instanceof Response) return s;
  const q = (new URL(req.url).searchParams.get("q") || "").trim().toLowerCase().slice(0, 40);
  const qDigits = q.replace(/\D/g, "");
  let list = listPatients();
  if (q) list = list.filter((p) => p.name.toLowerCase().includes(q) || (qDigits.length >= 3 && p.phone.includes(qDigits)));
  // The audit log records that a search happened and how many people matched, never what was typed.
  if (q) logAudit(s, "searched patients", `${list.length} result${list.length === 1 ? "" : "s"}`);
  const rows = list.map((p) => {
    const bills = listBillsForUser(p.id);
    return {
      id: p.id,
      name: maskName(p.name),
      phone: maskPhone(p.phone),
      visitType: p.visitType,
      registeredAt: p.registeredAt,
      registeredBy: p.registeredBy,
      bills: bills.length,
      // Front desk staff see no money amounts (minimum necessary).
      balance: s.role === "admin" ? bills.reduce((t, b) => t + b.total, 0) : null,
    };
  });
  return Response.json({ patients: rows, role: s.role, templates: listTemplates() });
}

export async function POST(req: Request) {
  const s = needStaff(req);
  if (s instanceof Response) return s;
  const body = (await req.json()) as { name?: string; phone?: string; visitType?: string; templateBillId?: string };
  const template = body.templateBillId && TEMPLATE_IDS.includes(body.templateBillId) ? getBill(body.templateBillId) : undefined;
  const r = registerPatient({ name: body.name || "", phone: body.phone || "", visitType: body.visitType || "Outpatient" }, s.name, template);
  if (!r.patient) return Response.json({ error: r.error }, { status: 400 });
  logAudit(s, "registered a patient", `${r.patient.visitType}${template ? ", bill attached" : ""}`);
  void findByPhone;
  return Response.json({ ok: true, patient: { id: r.patient.id, name: maskName(r.patient.name), phone: maskPhone(r.patient.phone) } });
}
