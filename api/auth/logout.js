import { clientFromRequest } from "../_lib/supabase.js";
import { clearCookie, send, setCookies } from "../_lib/http.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "method_not_allowed" });
  try {
    const ctx = await clientFromRequest(req, res);
    if (ctx) await ctx.supabase.auth.signOut();
  } catch {
    /* cookies se borran igual */
  }
  setCookies(res, [clearCookie("sb-access-token"), clearCookie("sb-refresh-token")]);
  return send(res, 200, { ok: true });
}
