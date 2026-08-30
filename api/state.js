import { requireUser } from "./_lib/supabase.js";
import { readJson, send } from "./_lib/http.js";
import { CHILD_TABLES, fromDb, isUuid, toDb } from "./_lib/map.js";

const LOAD_TABLES = [
  "habitantes",
  "plantas",
  "equipos",
  "parametros",
  "tareas",
  "tareas_log",
  "mediciones_habitante",
  "eventos_salud",
  "documentos",
  "timeline",
  "alimentaciones",
  "iluminacion",
  "periodos_cuidador",
  "auditoria",
];

async function loadState(supabase, user) {
  const { data: perfil } = await supabase.from("perfiles").select("id,nombre,email").eq("id", user.id).maybeSingle();
  const { data: ecosistemas, error: ecoErr } = await supabase.from("ecosistemas").select("*");
  if (ecoErr) throw ecoErr;

  const rows = { ecosistemas: ecosistemas || [] };
  const ecoIds = rows.ecosistemas.map((e) => e.id);

  if (ecoIds.length) {
    for (const table of LOAD_TABLES) {
      const { data, error } = await supabase.from(table).select("*").in("ecosistema", ecoIds);
      if (error) throw error;
      rows[table] = data || [];
    }
    const periodoIds = (rows.periodos_cuidador || []).map((p) => p.id);
    if (periodoIds.length) {
      const { data, error } = await supabase.from("instrucciones_cuidador").select("*").in("periodo", periodoIds);
      if (error) throw error;
      rows.instrucciones_cuidador = data || [];
    }
    const { data: mants } = await supabase.from("equipos_mantenimiento").select("*").in("ecosistema", ecoIds);
    const lastMant = {};
    for (const m of mants || []) {
      if (!lastMant[m.equipo] || m.fecha > lastMant[m.equipo]) lastMant[m.equipo] = m.fecha;
    }
    for (const q of rows.equipos || []) q.ultimo_mant = lastMant[q.id] || null;
  }

  return fromDb(user, perfil, rows);
}

async function replaceTable(supabase, table, rows, ecoIds, idField = "id") {
  if (!ecoIds.length) return;
  const { data: existing, error: readErr } = await supabase.from(table).select(idField).in("ecosistema", ecoIds);
  if (readErr) throw readErr;
  const keep = new Set(rows.map((r) => r[idField]).filter(Boolean));
  const del = (existing || []).map((r) => r[idField]).filter((id) => !keep.has(id));
  if (del.length) {
    const { error } = await supabase.from(table).delete().in(idField, del);
    if (error) throw error;
  }
  if (rows.length) {
    const { error } = await supabase.from(table).upsert(rows, { onConflict: idField });
    if (error) throw error;
  }
}

async function saveState(supabase, user, S) {
  const payload = toDb(user.id, S);
  const ecoIds = payload.ecosistemas.map((e) => e.id);

  const { data: current } = await supabase.from("ecosistemas").select("id");
  const incoming = new Set(ecoIds);
  const drop = (current || []).map((e) => e.id).filter((id) => !incoming.has(id));

  if (drop.length) {
    const { data: periodosDrop } = await supabase.from("periodos_cuidador").select("id").in("ecosistema", drop);
    if (periodosDrop?.length) {
      const pids = periodosDrop.map((p) => p.id);
      await supabase.from("instrucciones_cuidador").delete().in("periodo", pids);
    }
    for (const table of CHILD_TABLES) {
      const { error } = await supabase.from(table).delete().in("ecosistema", drop);
      if (error) throw error;
    }
    const { error } = await supabase.from("ecosistemas").delete().in("id", drop);
    if (error) throw error;
  }

  if (payload.ecosistemas.length) {
    const { error } = await supabase.from("ecosistemas").upsert(payload.ecosistemas, { onConflict: "id" });
    if (error) throw error;
  }

  if (!ecoIds.length) return;

  await replaceTable(supabase, "habitantes", payload.habitantes, ecoIds);
  await replaceTable(supabase, "plantas", payload.plantas, ecoIds);
  await replaceTable(supabase, "equipos", payload.equipos, ecoIds);
  await replaceTable(supabase, "tareas", payload.tareas, ecoIds);
  await replaceTable(supabase, "parametros", payload.parametros, ecoIds);
  await replaceTable(supabase, "tareas_log", payload.tareas_log, ecoIds);
  await replaceTable(supabase, "mediciones_habitante", payload.mediciones_habitante, ecoIds);
  await replaceTable(supabase, "eventos_salud", payload.eventos_salud, ecoIds);
  await replaceTable(supabase, "documentos", payload.documentos, ecoIds);
  await replaceTable(supabase, "timeline", payload.timeline, ecoIds);
  await replaceTable(supabase, "alimentaciones", payload.alimentaciones, ecoIds);

  const { data: existingLuz } = await supabase.from("iluminacion").select("id,ecosistema").in("ecosistema", ecoIds);
  const luzByEco = Object.fromEntries((existingLuz || []).map((l) => [l.ecosistema, l.id]));
  const luzRows = payload.iluminacion.map((l) => ({
    ...l,
    id: l.id && isUuid(l.id) ? l.id : luzByEco[l.ecosistema] || crypto.randomUUID(),
  }));
  await replaceTable(supabase, "iluminacion", luzRows, ecoIds);

  const c = S.caretaker || {};
  const { data: periodos } = await supabase.from("periodos_cuidador").select("id").in("ecosistema", ecoIds);
  if (periodos?.length) {
    const pids = periodos.map((p) => p.id);
    await supabase.from("instrucciones_cuidador").delete().in("periodo", pids);
    await supabase.from("periodos_cuidador").delete().in("id", pids);
  }
  if (c.persona || c.activo) {
    const ecoId = ecoIds[0];
    const periodoId = crypto.randomUUID();
    const { error } = await supabase.from("periodos_cuidador").insert({
      id: periodoId,
      ecosistema: ecoId,
      cuidador: user.id,
      nombre_cuidador: c.persona || null,
      desde: c.desde || null,
      hasta: c.hasta || null,
      activo: !!c.activo,
    });
    if (error) throw error;
    const instr = (c.noHacer || []).map((texto, orden) => ({
      id: crypto.randomUUID(),
      periodo: periodoId,
      texto,
      prohibido: true,
      orden,
    }));
    if (instr.length) {
      const { error: iErr } = await supabase.from("instrucciones_cuidador").insert(instr);
      if (iErr) throw iErr;
    }
  }

  for (const q of S.equipment || []) {
    if (!isUuid(q.id) || !q.ultimoMant) continue;
    const { data: already } = await supabase
      .from("equipos_mantenimiento")
      .select("id")
      .eq("equipo", q.id)
      .eq("fecha", q.ultimoMant)
      .maybeSingle();
    if (!already) {
      await supabase.from("equipos_mantenimiento").insert({
        id: crypto.randomUUID(),
        equipo: q.id,
        ecosistema: q.ecoId,
        fecha: q.ultimoMant,
        descripcion: "Mantenimiento",
        autor: user.id,
      });
    }
  }
}

export default async function handler(req, res) {
  const ctx = await requireUser(req, res);
  if (!ctx) return;
  const { supabase, user } = ctx;

  try {
    if (req.method === "GET") {
      const state = await loadState(supabase, user);
      return send(res, 200, { empty: !state.ecosystems.length, state });
    }
    if (req.method === "PUT") {
      const body = await readJson(req);
      if (!body?.state) return send(res, 400, { error: "missing_state" });
      await saveState(supabase, user, body.state);
      return send(res, 200, { ok: true });
    }
    return send(res, 405, { error: "method_not_allowed" });
  } catch (e) {
    return send(res, 500, { error: "state_failed", detail: e.message || "error" });
  }
}
