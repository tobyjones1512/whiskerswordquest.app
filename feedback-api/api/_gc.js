// Shared helpers for the licence endpoints. Secrets come from Vercel environment variables:
// GOCARDLESS_ACCESS_TOKEN, LICENCE_SECRET, and GOCARDLESS_ENV ("live" to go live; anything else is sandbox).
import crypto from "node:crypto";

const BASE = process.env.GOCARDLESS_ENV === "live" ? "https://api.gocardless.com" : "https://api-sandbox.gocardless.com";
export const ORIGINS = ["https://whiskerswordquest.app", "https://www.whiskerswordquest.app"];
export const PRICES = { month: { amount: 3500, unit: "monthly" }, year: { amount: 35000, unit: "yearly" } };

export async function gc(method, path, body, idempotencyKey) {
  const r = await fetch(BASE + path, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.GOCARDLESS_ACCESS_TOKEN}`,
      "GoCardless-Version": "2015-07-06",
      Accept: "application/json",
      ...(body && { "Content-Type": "application/json" }),
      ...(idempotencyKey && { "Idempotency-Key": idempotencyKey }),
    },
    body: body && JSON.stringify(body),
  });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}

export const norm = (s) => String(s ?? "").trim().replace(/\s+/g, " ").toLowerCase();

const tag = (id) => crypto.createHmac("sha256", process.env.LICENCE_SECRET).update(id).digest("hex").slice(0, 10).toUpperCase();
export const makeKey = (subscriptionId) => `WWQ-${subscriptionId}-${tag(subscriptionId)}`;
/** Returns the GoCardless subscription id inside a genuine key, or null. */
export function parseKey(key) {
  const m = /^WWQ-(SB[A-Z0-9]+)-([A-F0-9]{10})$/.exec(String(key ?? "").trim().toUpperCase());
  return m && crypto.timingSafeEqual(Buffer.from(tag(m[1])), Buffer.from(m[2])) ? m[1] : null;
}

/** Sets CORS headers; returns true when the request has been fully answered. */
export function cors(req, res, methods) {
  const origin = req.headers.origin;
  if (ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", `${methods}, OPTIONS`);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(204).end(); return true; }
  if (req.method !== methods) { res.status(405).json({ error: `${methods} only.` }); return true; }
  return false;
}

// ---- Maestro Pro student licences: the key is derived from the email, so nothing is stored.
const STUDENT_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const studentKey = (email) => {
  const h = crypto.createHmac("sha256", process.env.LICENCE_SECRET).update("maestro-students:" + norm(email)).digest();
  const s = Array.from(h.subarray(0, 20), (b) => STUDENT_ALPHABET[b % 32]).join("");
  return s.match(/.{5}/g).join("-");
};
export const validEmail = (e) => /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(e) && e.length <= 200;
export const sameKey = (a, b) => {
  const x = Buffer.from(String(a ?? "").trim().toUpperCase()), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

/** True when GoCardless shows this email's latest bill is paid or on its way: an active subscription, or a £48+ payment in the last year. */
export async function studentHasPaid(email) {
  const want = norm(email);
  // ponytail: scans every customer (500 a page); switch to a stored customer id if this passes a few thousand.
  let after = "", ids = [];
  for (let page = 0; page < 20; page++) {
    const res = await gc("GET", `/customers?limit=500${after && `&after=${after}`}`);
    if (res.status !== 200) throw new Error("GoCardless: " + JSON.stringify(res.data.error || res.status)); // e.g. a sandbox token against the live API
    const r = res.data;
    ids.push(...(r.customers || []).filter((c) => norm(c.email) === want).map((c) => c.id));
    after = r.meta?.cursors?.after;
    if (!after) break;
  }
  const yearAgo = Date.now() - 366 * 864e5;
  // Bacs takes days, so a payment still on its way counts; one that failed, was cancelled or was charged back does not.
  const bad = ["failed", "cancelled", "customer_approval_denied", "charged_back"];
  for (const id of ids) {
    const pays = ((await gc("GET", `/payments?customer=${id}`)).data.payments || []).sort((x, y) => Date.parse(y.created_at) - Date.parse(x.created_at));
    const latest = pays[0];   // the latest bill must not have bounced
    const subs = ((await gc("GET", `/subscriptions?customer=${id}`)).data.subscriptions || []).filter((x) => ["active", "pending_customer_approval", "pending_first_payment"].includes(x.status));
    if (subs.length && !(latest && bad.includes(latest.status))) return true;
    if (latest && !bad.includes(latest.status) && latest.amount >= 4800 && Date.parse(latest.created_at) > yearAgo) return true;
  }
  return false;
}
