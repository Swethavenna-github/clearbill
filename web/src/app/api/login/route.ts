import { CLINICS, lookupPhone, normalizePhone } from "@/lib/users";

// POST /api/login { phone } -> the registered patient, or "not registered" plus the clinics to sign up with.
export async function POST(req: Request) {
  const { phone } = (await req.json()) as { phone?: string };
  const digits = normalizePhone(phone || "");
  if (digits.length < 9) {
    return Response.json({ error: "Enter a full phone number." }, { status: 400 });
  }
  const user = lookupPhone(digits);
  if (!user) {
    return Response.json({ registered: false, clinics: CLINICS }, { status: 200 });
  }
  return Response.json({ registered: true, user: { id: user.id, name: user.name, initials: user.initials, blurb: user.blurb } });
}
