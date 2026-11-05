// Used by the Maestro Pro app: valid when the key is genuine and that GoCardless customer's latest bill is paid.
import { parseStudentKey, studentHasPaid } from "./_gc.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only." });
  const id = parseStudentKey(req.body?.key);
  if (!id) return res.status(200).json({ valid: false, error: "That licence key isn't valid." });
  try {
    if (!(await studentHasPaid(id))) return res.status(200).json({ valid: false, error: "We can't find a current payment for this licence." });
    res.status(200).json({ valid: true });
  } catch {
    res.status(502).json({ valid: false, error: "Couldn't check the licence. Try again online." });
  }
}
