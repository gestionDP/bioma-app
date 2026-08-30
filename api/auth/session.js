import { clientFromRequest } from "../_lib/supabase.js";
import { send } from "../_lib/http.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return send(res, 405, { error: "method_not_allowed" });
  try {
    const ctx = await clientFromRequest(req, res);
    if (!ctx) return send(res, 200, { user: null });
    return send(res, 200, {
      user: {
        id: ctx.user.id,
        email: ctx.user.email,
        nombre: ctx.user.user_metadata?.nombre || ctx.user.email,
      },
    });
  } catch (e) {
    return send(res, e.status || 500, { error: "session_failed" });
  }
}
