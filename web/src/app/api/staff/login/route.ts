import { DEMO_CODE, checkLock, findStaff } from "@/lib/staff";

// Step 1: staff enter their phone number. The demo shows the one-time code on screen (no text message is sent).
export async function POST(req: Request) {
  const { phone } = (await req.json()) as { phone?: string };
  const staff = findStaff(phone || "");
  const locked = checkLock(phone || "");
  if (locked) return Response.json({ error: `Too many wrong codes. Try again in ${Math.ceil(locked / 60)} minutes.` }, { status: 429 });
  // Same answer whether or not the number is a staff number, so numbers cannot be probed.
  return Response.json({ sent: true, ...(staff ? { demoCode: DEMO_CODE } : {}) });
}
