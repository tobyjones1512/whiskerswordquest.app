// The escalations desk's API (the hidden page at https://maestro-pro.app/escalations/). Protected by one password, the ADMIN_PASSWORD
// environment variable on Vercel, sent as "Authorization: Bearer <password>". Lists the stored email chains, opens one, sends Toby's reply
// from escalations@maestro-pro.app in the same email design as the support bot, and sets a chain's status.
import crypto from "node:crypto";
import { buildEmail, guideTree, LINKS, send, firstSentence, ESCALATIONS } from "./support-inbound.js";
import { loadIndex, loadThread, recordMessage, saveThread, storeReady } from "./_threads.js";

const ORIGINS = ["https://maestro-pro.app", "https://www.maestro-pro.app"];
const FROM = () => process.env.ESCALATIONS_FROM || `Maestro Pro Escalations <${ESCALATIONS}>`;
const sha = (x) => crypto.createHash("sha256").update(String(x)).digest();

export function authorised(header, password = process.env.ADMIN_PASSWORD) {
  if (!password) return false;
  const given = /^Bearer\s+(.+)$/i.exec(String(header || ""))?.[1] || "";
  return crypto.timingSafeEqual(sha(given), sha(password));
}

/** Link targets Toby may use in a reply: [text](https://...) for any web address, or a guide slug. Anything else keeps its text only. */
export const makeResolve = (known) => (t) => {
  const x = String(t).trim();
  return /^https:\/\/[^\s"<>]+$/.test(x) ? x : LINKS[x]?.[1] || known.get(x)?.url || null;
};

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (ORIGINS.includes(origin)) { res.setHeader("Access-Control-Allow-Origin", origin); res.setHeader("Vary", "Origin"); }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (!process.env.ADMIN_PASSWORD) return res.status(503).json({ error: "ADMIN_PASSWORD is not set on the server." });
  if (!authorised(req.headers.authorization)) { await new Promise((r) => setTimeout(r, 600)); return res.status(401).json({ error: "Wrong password." }); }

  try {
    if (req.method === "GET") {
      if (!storeReady()) return res.status(200).json({ storage: false, threads: [] });
      if (req.query.id) { const thread = await loadThread(req.query.id); return thread ? res.status(200).json({ storage: true, thread }) : res.status(404).json({ error: "No such chain." }); }
      return res.status(200).json({ storage: true, threads: await loadIndex() });
    }
    if (req.method !== "POST") return res.status(405).json({ error: "GET or POST only." });
    if (!storeReady()) return res.status(503).json({ error: "Storage is not connected." });
    const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const thread = await loadThread(b.id);
    if (!thread) return res.status(404).json({ error: "No such chain." });

    if (b.action === "status") {
      if (!["open", "answered", "done"].includes(b.status)) return res.status(400).json({ error: "Bad status." });
      thread.status = b.status; thread.updatedAt = new Date().toISOString();
      await saveThread(thread);
      return res.status(200).json({ ok: true, thread });
    }

    if (b.action === "escalate") {
      // Take a chain over by hand. A bot reply still waiting out its delay is cancelled at Resend and marked deleted, so the customer never gets it.
      const waiting = thread.messages.filter((m) => m.by === "bot" && m.resendId && m.scheduledAt && !m.cancelled && Date.parse(m.scheduledAt) > Date.now());
      let deleted = 0;
      for (const m of waiting) {
        const c = await fetch(`https://api.resend.com/emails/${encodeURIComponent(m.resendId)}/cancel`, { method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` } });
        if (c.ok) { m.cancelled = true; deleted++; }
        else return res.status(409).json({ error: "That reply could not be cancelled, it may just have been sent. Refresh and check." });
      }
      const now = new Date().toISOString();
      if (!thread.escalated) { thread.escalated = true; thread.escalatedAt = now; thread.reason = "Escalated by you"; }
      thread.status = "open"; thread.updatedAt = now;
      await saveThread(thread);
      return res.status(200).json({ ok: true, deleted, thread });
    }

    if (b.action === "reply") {
      const text = String(b.text || "").replace(/\r\n/g, "\n").trim();
      if (!text) return res.status(400).json({ error: "Write a reply first." });
      if (text.length > 6000) return res.status(400).json({ error: "That reply is too long." });
      if (!thread.escalated) return res.status(400).json({ error: "Only escalated chains can be answered here." });
      const { pages } = await guideTree();
      const known = new Map(pages.map((p) => [p.slug, p]));
      const guides = [...new Set([].concat(b.guides || []).map(String))].filter((s) => known.has(s)).slice(0, 6).map((s) => { const g = known.get(s); return { slug: s, title: g.title, url: g.url, summary: firstSentence(g.summary || "") }; });
      const { html, text: plain } = buildEmail({ name: thread.name, reply: text, guides, resolve: makeResolve(known), label: "Escalations", contact: ESCALATIONS });
      const lastIn = [...thread.messages].reverse().find((m) => m.dir === "in" && m.msgId)?.msgId;
      const r = await send({
        from: FROM(), to: [thread.customer], reply_to: ESCALATIONS,
        subject: /^re:/i.test(thread.subject) ? thread.subject : `Re: ${thread.subject}`,
        text: plain, html,
        ...(lastIn && { headers: { "In-Reply-To": lastIn, References: lastIn } }),
      }, `desk-${thread.id}-${crypto.randomUUID()}`);
      if (!r.ok) return res.status(502).json({ error: `The email could not be sent (Resend ${r.status}).` });
      const sent = await recordMessage({ customer: thread.customer, name: thread.name, subject: thread.subject, message: { key: `desk-${crypto.randomUUID()}`, dir: "out", by: "toby", text: plain, guides: guides.map((g) => g.title) }, status: "answered" });
      return res.status(200).json({ ok: true, thread: sent });
    }
    return res.status(400).json({ error: "Unknown action." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Something went wrong on the server." });
  }
}
