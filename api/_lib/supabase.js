import { createClient } from "@supabase/supabase-js";
import { parseCookies, send, sessionCookies, setCookies } from "./http.js";

function env() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    const err = new Error("missing_server_env");
    err.status = 500;
    throw err;
  }
  return { url, key };
}

export function anonClient() {
  const { url, key } = env();
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function clientWithSession(accessToken, refreshToken) {
  const supabase = anonClient();
  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error || !data.session?.access_token || !data.user) return null;
  return { supabase, user: data.user, session: data.session };
}

export async function clientFromRequest(req, res) {
  const cookies = parseCookies(req);
  const access = cookies["sb-access-token"];
  const refresh = cookies["sb-refresh-token"];

  if (access && refresh) {
    const ctx = await clientWithSession(access, refresh);
    if (ctx) {
      if (ctx.session.access_token !== access || ctx.session.refresh_token !== refresh) {
        setCookies(res, sessionCookies(ctx.session));
      }
      return ctx;
    }
  }

  if (refresh) {
    const supabase = anonClient();
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refresh });
    if (!error && data.session?.access_token && data.user) {
      setCookies(res, sessionCookies(data.session));
      return { supabase, user: data.user, session: data.session };
    }
  }

  return null;
}

export async function requireUser(req, res) {
  try {
    const ctx = await clientFromRequest(req, res);
    if (!ctx) {
      send(res, 401, { error: "unauthorized" });
      return null;
    }
    return ctx;
  } catch (e) {
    send(res, e.status || 500, { error: e.message === "missing_server_env" ? "server_misconfigured" : "auth_failed" });
    return null;
  }
}
