import type { Bill } from "./types";

// The clinic's patient list and registration requests (in server memory for the prototype; a real
// product would keep them in an encrypted database). All people here are fictional.
export type VisitType = "Outpatient" | "Inpatient" | "Emergency";
export type Patient = {
  id: string;
  name: string;
  phone: string; // digits only, without +1
  visitType: VisitType;
  registeredAt: string;
  registeredBy: string;
  bills: Bill[];
};
export type RegRequest = {
  id: string;
  name: string;
  phone: string;
  status: "pending" | "approved" | "declined";
  createdAt: string;
  decidedBy?: string;
  decidedAt?: string;
};

const g = globalThis as unknown as { __cbPatients?: Map<string, Patient>; __cbRequests?: RegRequest[] };
const patients = (g.__cbPatients ??= new Map<string, Patient>());
const requests = (g.__cbRequests ??= []);

export const digitsOf = (s: string) => {
  let d = String(s ?? "").replace(/\D/g, "").slice(0, 15);
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  return d;
};
const validPhone = (d: string) => d.length >= 9 && d.length <= 10;
const validName = (n: string) => /^[A-Za-z][A-Za-z .'-]{1,59}$/.test(n);

// Ethan is the demo patient the clinic registered earlier. His bill comes from the sample data.
if (!patients.has("123456789")) {
  patients.set("123456789", {
    id: "ethan",
    name: "Ethan Cole",
    phone: "123456789",
    visitType: "Emergency",
    registeredAt: "2026-09-14T10:00:00.000Z",
    registeredBy: "Sam Rivera",
    bills: [],
  });
}

// Sample clinic data (all fictional) so the clinic side is not empty: the other patients, and a few registration
// requests, some waiting and some already handled. Phone numbers use the reserved fictional 555-01xx range.
const gs = globalThis as unknown as { __cbRegSeeded?: boolean };
if (!gs.__cbRegSeeded) {
  gs.__cbRegSeeded = true;
  const ago = (days: number, hours = 0) => new Date(Date.now() - days * 86_400_000 - hours * 3_600_000).toISOString();
  const seeds: { id: string; name: string; phone: string; visitType: VisitType; days: number; by: string }[] = [
    { id: "maria", name: "Maria Lopez", phone: "5550100101", visitType: "Emergency", days: 41, by: "Sam Rivera" },
    { id: "james", name: "James Okafor", phone: "5550100102", visitType: "Outpatient", days: 33, by: "Dana Lee" },
    { id: "priya", name: "Priya Raman", phone: "5550100103", visitType: "Outpatient", days: 29, by: "Dana Lee" },
    { id: "daniel", name: "Daniel Brooks", phone: "5550100104", visitType: "Outpatient", days: 24, by: "Dana Lee" },
    { id: "aisha", name: "Aisha Khan", phone: "5550100105", visitType: "Inpatient", days: 19, by: "Sam Rivera" },
    { id: "elena", name: "Elena Petrova", phone: "5550100106", visitType: "Outpatient", days: 14, by: "Dana Lee" },
    { id: "tom", name: "Tom Nguyen", phone: "5550100107", visitType: "Outpatient", days: 11, by: "Dana Lee" },
    { id: "rosa", name: "Rosa Martinez", phone: "5550100108", visitType: "Emergency", days: 6, by: "Sam Rivera" },
    { id: "sam", name: "Sam Walker", phone: "5550100109", visitType: "Inpatient", days: 4, by: "Sam Rivera" },
    { id: "p-5550100110", name: "Hannah Brooks", phone: "5550100110", visitType: "Outpatient", days: 1, by: "Dana Lee" },
  ];
  for (const s of seeds) {
    if (!patients.has(s.phone)) patients.set(s.phone, { id: s.id, name: s.name, phone: s.phone, visitType: s.visitType, registeredAt: ago(s.days), registeredBy: s.by, bills: [] });
  }
  if (requests.length === 0) {
    requests.push(
      { id: "req-sample-1", name: "Noah Bennett", phone: "5550100201", status: "pending", createdAt: ago(0, 2) },
      { id: "req-sample-2", name: "Grace Kim", phone: "5550100202", status: "pending", createdAt: ago(0, 5) },
      { id: "req-sample-3", name: "Luis Ortega", phone: "5550100203", status: "pending", createdAt: ago(1, 3) },
      { id: "req-sample-4", name: "Hannah Brooks", phone: "5550100110", status: "approved", createdAt: ago(1, 9), decidedBy: "Dana Lee", decidedAt: ago(1, 8) },
      { id: "req-sample-5", name: "Victor Hale", phone: "5550100204", status: "declined", createdAt: ago(3), decidedBy: "Sam Rivera", decidedAt: ago(3, -1) },
    );
  }
}

export const listPatients = () => Array.from(patients.values()).sort((a, b) => b.registeredAt.localeCompare(a.registeredAt));
export const findByPhone = (phone: string) => {
  const d = digitsOf(phone);
  return patients.get(d) ?? (d.length === 10 && d.startsWith("1") ? patients.get(d.slice(0, 9)) : undefined);
};
export const findById = (id: string) => Array.from(patients.values()).find((p) => p.id === id);

export function registerPatient(
  input: { name: string; phone: string; visitType: string },
  by: string,
  template?: Bill,
): { patient?: Patient; error?: string } {
  const name = String(input.name ?? "").replace(/\s+/g, " ").trim();
  const phone = digitsOf(input.phone);
  if (!validName(name)) return { error: "Enter the patient's full name (letters only)." };
  if (!validPhone(phone)) return { error: "Enter a valid US phone number." };
  if (findByPhone(phone)) return { error: "That phone number is already registered." };
  const visitType = (["Outpatient", "Inpatient", "Emergency"].includes(input.visitType) ? input.visitType : "Outpatient") as VisitType;
  const id = `p-${phone}`;
  const bills: Bill[] = [];
  if (template) {
    const { answer_key: _key, ...rest } = template;
    void _key;
    bills.push({ ...(rest as Bill), bill_id: `${id}-${template.bill_id}`, patient: { ...template.patient, name } });
  }
  const patient: Patient = { id, name, phone, visitType, registeredAt: new Date().toISOString(), registeredBy: by, bills };
  patients.set(phone, patient);
  return { patient };
}

export const listRequests = () => requests.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));

// Anyone can ask a clinic to register their number. The request waits for staff to approve it.
export function createRequest(input: { name: string; phone: string }): { request?: RegRequest; error?: string } {
  const name = String(input.name ?? "").replace(/\s+/g, " ").trim();
  const phone = digitsOf(input.phone);
  if (!validName(name)) return { error: "Enter your full name (letters only)." };
  if (!validPhone(phone)) return { error: "Enter a valid US phone number." };
  if (findByPhone(phone)) return { error: "This number is already registered. Try signing in." };
  if (requests.filter((r) => r.phone === phone && r.status === "pending").length >= 1) return { error: "A request for this number is already waiting for the clinic." };
  if (requests.filter((r) => r.status === "pending").length >= 50) return { error: "The clinic has too many open requests right now. Please call the front desk." };
  const request: RegRequest = { id: `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, name, phone, status: "pending", createdAt: new Date().toISOString() };
  requests.push(request);
  return { request };
}

export function decideRequest(id: string, decision: "approved" | "declined", by: string, template?: Bill): { request?: RegRequest; patient?: Patient; error?: string } {
  const r = requests.find((x) => x.id === id);
  if (!r) return { error: "Request not found." };
  if (r.status !== "pending") return { error: "That request was already handled." };
  let patient: Patient | undefined;
  if (decision === "approved") {
    const res = registerPatient({ name: r.name, phone: r.phone, visitType: "Outpatient" }, by, template);
    if (res.error) return { error: res.error };
    patient = res.patient;
  }
  r.status = decision;
  r.decidedBy = by;
  r.decidedAt = new Date().toISOString();
  return { request: r, patient };
}
