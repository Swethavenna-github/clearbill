import type { Bill } from "./types";
import { normalizeCustom, type CustomInput } from "./custom";
import { getUser } from "./users";
import { findById, listPatients } from "./registry";
import B01 from "@/data/bills/B01.json";
import B02 from "@/data/bills/B02.json";
import B03 from "@/data/bills/B03.json";
import B04 from "@/data/bills/B04.json";
import B05 from "@/data/bills/B05.json";
import B06 from "@/data/bills/B06.json";
import B07 from "@/data/bills/B07.json";
import B08 from "@/data/bills/B08.json";
import B09 from "@/data/bills/B09.json";

// B06 (sessions attended) and B08 (screening coding) need data our simple rules cannot check yet, so they are left out of the demo list.
void B06;
void B08;
const ALL = [B09, B01, B02, B03, B04, B05, B07] as unknown as Bill[];

// Bills the clinic can attach to a newly registered patient (a copy with the patient's own name).
export const TEMPLATE_IDS = ["B01", "B02", "B03", "B04", "B05", "B07"];
export const listTemplates = () => ALL.filter((b) => TEMPLATE_IDS.includes(b.bill_id)).map((b) => ({ id: b.bill_id, title: b.title, total: b.total_charges }));

export function getBill(id: string): Bill | undefined {
  return ALL.find((b) => b.bill_id === id) ?? listPatients().flatMap((p) => p.bills).find((b) => b.bill_id === id);
}

// Does this patient own this bill?
function owns(userId: string, billId: string) {
  const u = getUser(userId);
  if (!u) return false;
  if (u.billId === billId) return true;
  return Boolean(findById(userId)?.bills.some((b) => b.bill_id === billId));
}

// Each registered patient sees only their own bills from the clinic.
export function listBillsForUser(userId: string) {
  const u = getUser(userId);
  if (!u) return [];
  const own = findById(userId)?.bills ?? [];
  const bills = [getBill(u.billId), ...own].filter((b, i, a): b is Bill => Boolean(b) && a.findIndex((x) => x?.bill_id === b?.bill_id) === i);
  return bills.map((b) => ({ id: b.bill_id, title: b.title, patient: b.patient.name, total: b.total_charges }));
}

// A request names either one of the user's clinic bills (billId) or carries a bill typed in by the user (bill).
export function resolveBill(body: { billId?: string; bill?: CustomInput; userId?: string }): { bill?: Bill; error?: string } {
  if (body.bill) return normalizeCustom(body.bill);
  if (body.billId) {
    const b = getBill(body.billId);
    if (!b) return { error: "Unknown bill" };
    // A user can only open their own bills.
    if (body.userId && !owns(body.userId, b.bill_id)) return { error: "That bill belongs to another user." };
    return { bill: b };
  }
  return { error: "No bill given." };
}

// The answer key exists only for our own tests; it never leaves the server.
export function publicBill(b: Bill): Bill {
  const { answer_key: _ignored, correct_patient_responsibility: _truth, ...rest } = b as Bill & { corrected_total_charges?: number };
  void _ignored;
  void _truth;
  return { ...(rest as Bill), correct_patient_responsibility: null };
}
