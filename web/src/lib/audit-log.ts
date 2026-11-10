import type { Staff } from "./staff";

// Who did what and when. Entries never contain patient names, phone numbers or search text, only ids and counts.
export type AuditEntry = { at: string; who: string; role: string; action: string; detail: string };

const g = globalThis as unknown as { __cbAudit?: AuditEntry[] };
const log = (g.__cbAudit ??= []);

export function logAudit(who: Staff | { name: string; role: string }, action: string, detail = "", at?: string) {
  log.unshift({ at: at ?? new Date().toISOString(), who: who.name, role: who.role, action, detail });
  if (log.length > 500) log.length = 500;
}

// Earlier activity (fictional) so the audit log is not empty on a fresh start.
const gs = globalThis as unknown as { __cbAuditSeeded?: boolean };
if (!gs.__cbAuditSeeded) {
  gs.__cbAuditSeeded = true;
  const mins = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
  const admin = { name: "Sam Rivera", role: "admin" };
  const desk = { name: "Dana Lee", role: "frontdesk" };
  const seed: [typeof admin, string, string, number][] = [
    [desk, "signed in", "", 1500],
    [desk, "registered a patient", "Outpatient", 1480],
    [desk, "approved a registration request", "", 1470],
    [admin, "signed in", "", 1100],
    [admin, "opened billing desk", "", 1090],
    [admin, "approved a payment plan", "", 1060],
    [desk, "searched patients", "2 results", 640],
    [desk, "revealed full patient details", "TN", 635],
    [desk, "registered a patient", "Emergency, bill attached", 420],
    [admin, "viewed audit log", "", 300],
    [desk, "signed out", "", 240],
    [admin, "asked the data assistant", "3 rows", 130],
  ];
  // Oldest first, so the newest ends up at the top of the list.
  for (const [who, action, detail, m] of seed) log.unshift({ at: mins(m), who: who.name, role: who.role, action, detail });
  log.sort((a, b) => b.at.localeCompare(a.at));
}

export const readAudit = () => log.slice(0, 200);
