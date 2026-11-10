import { digitsOf, findById, findByPhone } from "./registry";

// Patient sign-in by phone number. A number works only if the clinic has registered it. There is no real
// account system: a real product would verify the number by text message (OTP) and use a database.
export type DemoUser = { id: string; name: string; initials: string; billId: string; blurb: string };

// Sample patients with ready-made bills. Only Ethan has a phone number on the clinic's list at the start.
export const DEMO_USERS: DemoUser[] = [
  { id: "ethan", name: "Ethan Cole", initials: "EC", billId: "B09", blurb: "Cycling accident, emergency surgery" },
  { id: "maria", name: "Maria Lopez", initials: "ML", billId: "B01", blurb: "Emergency visit, chest pain" },
  { id: "james", name: "James Okafor", initials: "JO", billId: "B02", blurb: "Urgent care, ankle sprain" },
  { id: "priya", name: "Priya Raman", initials: "PR", billId: "B03", blurb: "Annual checkup" },
  { id: "daniel", name: "Daniel Brooks", initials: "DB", billId: "B04", blurb: "Back MRI" },
  { id: "aisha", name: "Aisha Khan", initials: "AK", billId: "B05", blurb: "Appendectomy" },
  { id: "elena", name: "Elena Petrova", initials: "EP", billId: "B07", blurb: "Diabetes follow-up" },
];

const initialsOf = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0].toUpperCase())
    .slice(0, 2)
    .join("");

export const normalizePhone = digitsOf;

// Anyone the clinic registered, including the demo patient Ethan.
export function lookupPhone(input: string): DemoUser | undefined {
  const p = findByPhone(input);
  if (!p) return undefined;
  const sample = DEMO_USERS.find((u) => u.id === p.id);
  if (sample) return sample;
  return { id: p.id, name: p.name, initials: initialsOf(p.name), billId: p.bills[0]?.bill_id ?? "", blurb: p.visitType };
}

export function getUser(id: string | null | undefined): DemoUser | undefined {
  const sample = DEMO_USERS.find((u) => u.id === id);
  if (sample) return sample;
  const p = id ? findById(id) : undefined;
  return p ? { id: p.id, name: p.name, initials: initialsOf(p.name), billId: p.bills[0]?.bill_id ?? "", blurb: p.visitType } : undefined;
}

// Fictional clinics shown to people whose number is not registered yet.
export const CLINICS = [
  { name: "Riverbend Community Hospital", kind: "Hospital, emergency and surgery", city: "Austin, TX" },
  { name: "Lakeside Urgent Care", kind: "Urgent care", city: "Chicago, IL" },
  { name: "Maple Street Family Clinic", kind: "Primary care", city: "Denver, CO" },
  { name: "Northgate Imaging Center", kind: "MRI, CT and X-ray", city: "Seattle, WA" },
  { name: "Cedar Valley Endoscopy Center", kind: "Outpatient procedures", city: "Atlanta, GA" },
];
