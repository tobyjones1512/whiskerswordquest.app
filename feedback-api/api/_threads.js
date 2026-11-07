// Storage for the support inbox and the escalations desk: one JSON file per email chain ("thread") in a Vercel Blob store, plus an index of
// summaries so the desk page loads fast. Needs BLOB_READ_WRITE_TOKEN (added automatically when a Blob store is connected to the project).
// BLOB_ACCESS is "private" (default) or "public", and must match how the store was created. Nothing here may ever break the support bot:
// callers wrap every call in try/catch, and without a store the bot simply works as before and the desk shows that storage is not connected.
import crypto from "node:crypto";
import { put, get } from "@vercel/blob";

export const storeReady = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const ACCESS = () => (process.env.BLOB_ACCESS === "public" ? "public" : "private");
const INDEX = "support/index.json";
const THREAD = (id) => `support/threads/${id}.json`;

/** "Re: Fwd: Hello  there" -> "hello there": the same chain whatever the mail app adds in front. */
export function normSubject(s) {
  let t = String(s ?? "").trim();
  for (;;) { const n = t.replace(/^\s*(re|fwd?|aw|sv)\s*:\s*/i, ""); if (n === t) break; t = n; }
  return t.toLowerCase().replace(/\s+/g, " ").trim();
}
/** One chain per customer address and subject. */
export const threadId = (customer, subject) => crypto.createHash("sha256").update(`${String(customer).trim().toLowerCase()}|${normSubject(subject)}`).digest("hex").slice(0, 16);

const blobStore = {
  async read(path) {
    try {
      const r = await get(path, { access: ACCESS(), useCache: false });
      if (!r || r.statusCode !== 200) return null;
      return JSON.parse(await new Response(r.stream).text());
    } catch { return null; }
  },
  write: (path, data) => put(path, JSON.stringify(data), { access: ACCESS(), allowOverwrite: true, addRandomSuffix: false, contentType: "application/json", cacheControlMaxAge: 60 }),
};
let store = blobStore;
export const useStore = (s) => { store = s || blobStore; };   // for tests
const readJson = (path) => store.read(path), writeJson = (path, data) => store.write(path, data);

const clip = (t, n) => String(t ?? "").replace(/\s+/g, " ").trim().slice(0, n);
export function summary(t) {
  const last = t.messages[t.messages.length - 1] || {};
  const waiting = t.messages.filter((m) => m.scheduledAt && !m.cancelled).map((m) => m.scheduledAt).sort().pop() || null;   // latest reply that has a send time and was not deleted
  return { scheduledAt: waiting, id: t.id, customer: t.customer, name: t.name || null, subject: t.subject, escalated: !!t.escalated, escalatedAt: t.escalatedAt || null, reason: t.reason || null, status: t.status, createdAt: t.createdAt, updatedAt: t.updatedAt, count: t.messages.length, preview: clip(last.text, 140), lastBy: last.by || null };
}

export const loadThread = (id) => (/^[a-f0-9]{16}$/.test(String(id)) ? readJson(THREAD(id)) : null);
export async function loadIndex() { return (await readJson(INDEX))?.threads || []; }

/** Saves the thread and its line in the index. (A webhook arriving at the very same moment as another could drop one index line; the thread file itself is kept.) */
export async function saveThread(t) {
  await writeJson(THREAD(t.id), t);
  const threads = (await loadIndex()).filter((x) => x.id !== t.id);
  threads.push(summary(t));
  threads.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  await writeJson(INDEX, { threads });
}

/** Adds a message to its chain (creating the chain if needed). `message.key` makes a retried webhook a no-op.
 *  `escalate` ({reason}) marks the chain as escalated; a customer message on an escalated chain reopens it. */
export async function recordMessage({ customer, name, subject, message, escalate, status }) {
  const id = threadId(customer, subject), now = message.at || new Date().toISOString();
  const t = (await loadThread(id)) || { id, customer: String(customer).trim().toLowerCase(), name: name || null, subject: String(subject).replace(/^\s*(re|fwd?)\s*:\s*/gi, "").trim() || "(no subject)", escalated: false, status: "bot", createdAt: now, updatedAt: now, messages: [] };
  if (message.key && t.messages.some((m) => m.key === message.key)) return t;
  if (name && !t.name) t.name = name;
  t.messages.push({ ...message, at: now, text: String(message.text ?? "").slice(0, 8000) });
  t.updatedAt = now;
  if (escalate) { t.escalated = true; t.escalatedAt = t.escalatedAt || now; t.reason = escalate.reason || t.reason; t.status = "open"; }
  else if (t.escalated && message.by === "customer") t.status = "open";
  if (status) t.status = status;
  await saveThread(t);
  return t;
}
