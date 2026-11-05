// Used by the Maestro Pro app: valid when the key matches the email and GoCardless shows that email has paid.
import { studentKey, studentHasPaid, validEmail, sameKey } from "./_gc.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only." });
  const { email, key } = req.body || {};
  const e = String(email ?? "").trim();
  if (!validEmail(e) || !sameKey(key, studentKey(e))) return res.status(200).json({ valid: false, error: "That licence key doesn't match this email address." });
  try {
    if (!(await studentHasPaid(e))) return res.status(200).json({ valid: false, error: "We can't find a current payment for this licence." });
    res.status(200).json({ valid: true });
  } catch {
    res.status(502).json({ valid: false, error: "Couldn't check the licence. Try again online." });
  }
}
