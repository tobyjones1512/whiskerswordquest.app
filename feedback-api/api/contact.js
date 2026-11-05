// Emails the For Education contact form to hello@, CCs the sender and sets them as reply-to.
// Needs RESEND_API_KEY (and a Resend-verified sender in CONTACT_FROM) in this Vercel project's environment.
const ORIGINS = ["https://whiskerswordquest.app", "https://www.whiskerswordquest.app"];
const TO = "hello@thecaffeinemediacompany.com";
const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only." });
  if (!ORIGINS.includes(origin)) return res.status(403).json({ error: "Not allowed." });

  const { name, email, message, website } = req.body || {};
  if (website) return res.status(200).json({ ok: true }); // honeypot
  const n = String(name ?? "").trim().slice(0, 100);
  const e = String(email ?? "").trim();
  const m = String(message ?? "").trim().slice(0, 5000);
  if (!n || !m) return res.status(400).json({ error: "Please fill in every field." });
  if (!/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(e) || e.length > 200) return res.status(400).json({ error: "Enter a valid email address." });

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.CONTACT_FROM || "Whiskers' Word Quest <noreply@thecaffeinemediacompany.com>",
        to: [TO], cc: [e], reply_to: e,
        subject: `Whiskers' Word Quest enquiry from ${n.replace(/[\r\n]/g, " ")}`,
        text: `From: ${n} <${e}>\n\n${m}`,
        html: `<p><b>From:</b> ${esc(n)} &lt;${esc(e)}&gt;</p><p>${esc(m).replace(/\n/g, "<br>")}</p>`,
      }),
    });
    if (!r.ok) return res.status(502).json({ error: "The email couldn't be sent." });
    res.status(200).json({ ok: true });
  } catch {
    res.status(502).json({ error: "Couldn't reach the email service." });
  }
}
