import type { Bill } from "./types";
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

export function listBills() {
  return ALL.map((b) => ({ id: b.bill_id, title: b.title, patient: b.patient.name, total: b.total_charges }));
}

export function getBill(id: string): Bill | undefined {
  return ALL.find((b) => b.bill_id === id);
}

// The answer key exists only for our own tests; it never leaves the server.
export function publicBill(b: Bill): Bill {
  const { answer_key: _ignored, correct_patient_responsibility: _truth, ...rest } = b as Bill & { corrected_total_charges?: number };
  void _ignored;
  void _truth;
  return { ...(rest as Bill), correct_patient_responsibility: null };
}
