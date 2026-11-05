// Canary beta sign-ups: emails the TestFlight link to the sender and a notification with their details to hello@.
// Needs RESEND_API_KEY (and optionally CONTACT_FROM) in this Vercel project's environment.
const ORIGINS = ["https://whiskerswordquest.app", "https://www.whiskerswordquest.app"];
const TO = "hello@thecaffeinemediacompany.com";
const LINK = "https://testflight.apple.com/join/ZHBZ1N34";
const ROLES = ["Parent", "Teacher", "Teaching Assistant", "Educational Institution", "Other Education Professional", "Other"];
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

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

  const { name, email, role, website } = req.body || {};
  if (website) return res.status(200).json({ ok: true }); // honeypot
  const n = String(name ?? "").replace(/[\r\n]/g, " ").trim().slice(0, 100);
  const e = String(email ?? "").trim();
  if (!n) return res.status(400).json({ error: "Please enter your name." });
  if (!/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(e) || e.length > 200) return res.status(400).json({ error: "Enter a valid email address." });
  if (!ROLES.includes(role)) return res.status(400).json({ error: "Choose who you are." });

  const from = process.env.CONTACT_FROM || "Whiskers' Word Quest <noreply@thecaffeinemediacompany.com>";
  const send = (msg) => fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, ...msg }),
  });
  try {
    // The notification goes first so you never lose a sign-up; the link email is what the person is waiting for.
    const [a, b] = await Promise.all([
      send({ to: [TO], reply_to: e, subject: `Canary beta sign-up: ${n} (${role})`, text: `Name: ${n}\nEmail: ${e}\nRole: ${role}` }),
      send({
        to: [e],
        subject: "Your Whiskers' Word Quest Canary beta link",
        text: `Hi ${n},\n\nThanks for joining the Whiskers' Word Quest Canary beta. Install it with TestFlight here:\n\n${LINK}\n\nCanary builds may be buggy and can break at any time. The game isn't finalised, and your child's progress may be reset after some updates.\n\nThis inbox is not monitored, so please do not reply to this email.`,
        html: `<p>Hi ${esc(n)},</p><p>Thanks for joining the Whiskers' Word Quest Canary beta. Install it with TestFlight here:</p><p><a href="${LINK}">${LINK}</a></p><p><b>Canary builds may be buggy and can break at any time.</b> The game isn't finalised, and your child's progress may be reset after some updates.</p><p>This inbox is not monitored, so please do not reply to this email.</p>`,
      }),
    ]);
    if (!b.ok) return res.status(502).json({ error: "The email couldn't be sent." });
    res.status(200).json({ ok: true, notified: a.ok });
  } catch {
    res.status(502).json({ error: "Couldn't reach the email service." });
  }
}
