import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// Clinic staff sign-in for the prototype: phone number + one-time code, two roles, lockout after repeated
// wrong codes, and a short session cookie. The one-time code is shown on screen because the demo does not
// send text messages. A real launch would send it by SMS (or use an authenticator app) and use a database.
export type Role = "admin" | "frontdesk";
export type Staff = { id: string; name: string; role: Role; phone: string };

export const STAFF: Staff[] = [
  { id: "admin", name: "Sam Rivera", role: "admin", phone: "987654321" },
  { id: "desk", name: "Dana Lee", role: "frontdesk", phone: "987654322" },
];

export const DEMO_CODE = "246810";
export const SESSION_SECONDS = 20 * 60;
const COOKIE = "cb_staff";

const g = globalThis as unknown as { __cbSecret?: string; __cbAttempts?: Map<string, { n: number; until: number }> };
const secret = () => (process.env.SESSION_SECRET || (g.__cbSecret ??= randomBytes(32).toString("hex")));
const attempts = (g.__cbAttempts ??= new Map());

const digits = (s: string) => String(s ?? "").replace(/\D/g, "");
const sign = (body: string) => createHmac("sha256", secret()).update(body).digest("base64url");

export function findStaff(phone: string) {
  const d = digits(phone);
  return STAFF.find((s) => s.phone === d);
}

export function checkLock(phone: string) {
  const a = attempts.get(digits(phone));
  return a && a.until > Date.now() ? Math.ceil((a.until - Date.now()) / 1000) : 0;
}

// Returns true when the code is right. Five wrong codes lock that number for 5 minutes.
export function verifyCode(phone: string, code: string) {
  const key = digits(phone);
  const a = attempts.get(key) ?? { n: 0, until: 0 };
  if (a.until > Date.now()) return false;
  if (String(code).trim() === DEMO_CODE) {
    attempts.delete(key);
    return true;
  }
  a.n += 1;
  if (a.n >= 5) {
    a.n = 0;
    a.until = Date.now() + 5 * 60_000;
  }
  attempts.set(key, a);
  return false;
}

export function makeCookie(staff: Staff, secure: boolean) {
  const body = Buffer.from(JSON.stringify({ id: staff.id, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS })).toString("base64url");
  const token = `${body}.${sign(body)}`;
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_SECONDS}${secure ? "; Secure" : ""}`;
}

export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

export function parseToken(token: string | undefined | null): Staff | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const want = Buffer.from(sign(body));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const { id, exp } = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof exp !== "number" || exp < Date.now() / 1000) return null;
    return STAFF.find((s) => s.id === id) ?? null;
  } catch {
    return null;
  }
}

export function sessionFrom(req: Request): Staff | null {
  const raw = req.headers.get("cookie") || "";
  const m = raw.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return parseToken(m?.[1]);
}

// For server pages (not API routes): who is signed in, read from the cookie.
export async function staffFromCookies(): Promise<Staff | null> {
  const jar = await cookies();
  return parseToken(jar.get(COOKIE)?.value);
}

// Use at the top of a protected route: const s = needStaff(req, ["admin"]); if (s instanceof Response) return s;
export function needStaff(req: Request, roles?: Role[]): Staff | Response {
  const s = sessionFrom(req);
  if (!s) return Response.json({ error: "Please sign in." }, { status: 401 });
  if (roles && !roles.includes(s.role)) return Response.json({ error: "Your role cannot do that." }, { status: 403 });
  return s;
}
