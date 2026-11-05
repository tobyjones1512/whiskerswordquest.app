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
