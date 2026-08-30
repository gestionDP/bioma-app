import { anonClient } from "../_lib/supabase.js";
import { readJson, send, sessionCookies, setCookies } from "../_lib/http.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "method_not_allowed" });

  let body;
  try {
    body = await readJson(req);
  } catch {
    return send(res, 400, { error: "invalid_json" });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password.replace(/[\u200B-\u200D\uFEFF]/g, "").trim() : "";
  if (!email || !password) return send(res, 400, { error: "missing_credentials" });

  try {
    const supabase = anonClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session || !data.user) {
      return send(res, 401, { error: "invalid_credentials" });
    }
    setCookies(res, sessionCookies(data.session));
    return send(res, 200, {
      user: {
        id: data.user.id,
        email: data.user.email,
        nombre: data.user.user_metadata?.nombre || data.user.email,
      },
    });
  } catch (e) {
    return send(res, e.status || 500, { error: "login_failed" });
  }
}
