const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(v) {
  return typeof v === "string" && UUID.test(v);
}

function time(v) {
  if (!v) return null;
  return String(v).length === 5 ? `${v}:00` : v;
}

function hhmm(v) {
  if (!v) return "";
  return String(v).slice(0, 5);
}

export function fromDb(user, perfil, rows) {
  const nombre = perfil?.nombre || user.user_metadata?.nombre || user.email;
  return {
    v: 1,
    users: [{ id: user.id, nombre, rol: "owner", email: user.email }],
    currentUser: user.id,
    ecosystems: (rows.ecosistemas || []).map((e) => ({
      id: e.id,
      name: e.nombre,
      type: e.tipo,
      subtype: e.subtitulo,
      liters: e.litros,
      dims: e.dims,
      status: e.estado,
      montaje: e.fecha_montaje,
      concepto: e.concepto,
      soil: e.sustrato,
      hardscape: e.hardscape,
      ubicacion: e.ubicacion,
      color: e.color,
    })),
    animals: (rows.habitantes || []).map((a) => ({
      id: a.id,
      ecoId: a.ecosistema,
      nombre: a.nombre,
      sci: a.nombre_cientifico,
      ident: a.identificacion,
      clase: a.clase,
      qty: a.cantidad,
      zona: a.zona,
      nocturno: a.nocturno,
      sizeCm: a.talla_actual_cm,
      adultCm: a.talla_adulta_cm,
      ingreso: a.fecha_ingreso,
      dieta: a.dieta,
      comportamiento: a.comportamiento,
      compat: a.compatible,
      incompat: a.incompatible,
      dificultad: a.dificultad,
      vida: a.vida,
      notas: a.notas,
      estado: a.estado,
      foto: a.foto_url,
    })),
    plants: (rows.plantas || []).map((p) => ({
      id: p.id,
      ecoId: p.ecosistema,
      nombre: p.nombre,
      sci: p.nombre_cientifico,
      zona: p.zona,
      luz: p.luz,
      co2: p.co2,
      estado: p.estado,
      ingreso: p.fecha_ingreso,
      notas: p.notas,
    })),
    equipment: (rows.equipos || []).map((q) => ({
      id: q.id,
      ecoId: q.ecosistema,
      nombre: q.nombre,
      marca: q.marca,
      modelo: q.modelo,
      tipo: q.tipo,
      caudal: q.caudal,
      potencia: q.potencia,
      instalado: q.fecha_instalacion,
      freqDias: q.frecuencia_mant_dias,
      ultimoMant: q.ultimo_mant || null,
      consumibles: q.consumibles,
      notas: q.notas,
    })),
    params: (rows.parametros || []).map((p) => ({
      id: p.id,
      ecoId: p.ecosistema,
      fecha: p.fecha,
      key: p.clave,
      val: p.valor,
      user: p.autor_nombre || "",
      metodo: p.metodo,
      nota: p.nota,
    })),
    tasks: (rows.tareas || []).map((t) => ({
      id: t.id,
      ecoId: t.ecosistema,
      titulo: t.titulo,
      tipo: t.tipo,
      freqDias: t.frecuencia_dias,
      hora: hhmm(t.hora),
      ultimo: t.ultima_vez,
      activa: t.activa,
      nota: t.instrucciones,
    })),
    taskLogs: (rows.tareas_log || []).map((l) => ({
      id: l.id,
      taskId: l.tarea,
      ecoId: l.ecosistema,
      fecha: l.fecha,
      ts: l.momento,
      user: l.autor_nombre || "",
      estado: l.estado,
      nota: l.nota,
    })),
    measurements: (rows.mediciones_habitante || []).map((m) => ({
      id: m.id,
      animalId: m.habitante,
      fecha: m.fecha,
      cm: m.longitud_cm,
      nota: m.nota,
    })),
    health: (rows.eventos_salud || []).map((h) => ({
      id: h.id,
      ecoId: h.ecosistema,
      animalRef: h.referencia,
      sintomas: h.sintomas,
      diagnostico: h.diagnostico,
      tratamiento: h.tratamiento,
      dosis: h.dosis,
      inicio: h.inicio,
      fin: h.fin,
      resultado: h.resultado,
      estado: h.estado,
    })),
    docs: (rows.documentos || []).map((d) => ({
      id: d.id,
      ecoId: d.ecosistema,
      titulo: d.titulo,
      tipo: d.tipo,
      cuerpo: d.cuerpo,
    })),
    timeline: (rows.timeline || []).map((t) => ({
      id: t.id,
      ecoId: t.ecosistema,
      fecha: t.fecha,
      tipo: t.tipo,
      texto: t.texto,
      hi: t.destacado,
    })),
    feedLogs: (rows.alimentaciones || []).map((f) => ({
      id: f.id,
      ecoId: f.ecosistema,
      ts: f.momento,
      user: f.autor_nombre || "",
      detalle: f.alimento,
    })),
    lighting: (rows.iluminacion || []).map((l) => ({
      id: l.id,
      ecoId: l.ecosistema,
      on: hhmm(l.encendido),
      off: hhmm(l.apagado),
      horas: l.horas,
      intensidad: l.intensidad,
      nota: l.nota,
    })),
    caretaker: caretakerFrom(rows.periodos_cuidador, rows.instrucciones_cuidador),
    chat: (rows.ia_mensajes || []).map((m) => ({
      role: m.rol === "assistant" ? "ai" : "me",
      text: m.contenido,
    })),
    audit: (rows.auditoria || []).map((a) => ({
      id: String(a.id),
      ts: a.momento,
      user: a.autor_nombre || "",
      accion: a.accion,
      detalle: a.tabla || "",
    })),
  };
}

function caretakerFrom(periodos, instrucciones) {
  const p = (periodos || []).find((x) => x.activo) || (periodos || [])[0];
  if (!p) {
    return {
      activo: false,
      desde: null,
      hasta: null,
      persona: "",
      noHacer: ["No echar más comida de la indicada", "No añadir productos ni medicación", "No limpiar filtros", "No cambiar la temperatura", "No introducir animales"],
    };
  }
  const noHacer = (instrucciones || [])
    .filter((i) => i.periodo === p.id && i.prohibido)
    .sort((a, b) => (a.orden || 0) - (b.orden || 0))
    .map((i) => i.texto);
  return {
    activo: !!p.activo,
    desde: p.desde,
    hasta: p.hasta,
    persona: p.nombre_cuidador || "",
    noHacer: noHacer.length ? noHacer : ["No echar más comida de la indicada", "No añadir productos ni medicación", "No limpiar filtros", "No cambiar la temperatura", "No introducir animales"],
  };
}

export function toDb(userId, S) {
  const ecos = (S.ecosystems || []).filter((e) => isUuid(e.id));
  const ecoIds = new Set(ecos.map((e) => e.id));
  const animals = (S.animals || []).filter((a) => isUuid(a.id) && ecoIds.has(a.ecoId));

  return {
    ecosistemas: ecos.map((e) => ({
      id: e.id,
      owner: userId,
      nombre: e.name,
      tipo: e.type || "acuario",
      subtitulo: e.subtype || null,
      litros: e.liters ?? null,
      dims: e.dims || null,
      estado: e.status || "montaje",
      fecha_montaje: e.montaje || null,
      concepto: e.concepto || null,
      sustrato: e.soil || null,
      hardscape: e.hardscape || null,
      ubicacion: e.ubicacion || null,
      color: e.color || "#7FD1A6",
    })),
    habitantes: animals.map((a) => ({
      id: a.id,
      ecosistema: a.ecoId,
      nombre: a.nombre,
      nombre_cientifico: a.sci || null,
      identificacion: a.ident || "pendiente",
      clase: a.clase || "pez",
      cantidad: a.qty || 1,
      zona: a.zona || null,
      nocturno: !!a.nocturno,
      talla_actual_cm: a.sizeCm ?? null,
      talla_adulta_cm: a.adultCm ?? null,
      fecha_ingreso: a.ingreso || null,
      dieta: a.dieta || null,
      comportamiento: a.comportamiento || null,
      compatible: a.compat || null,
      incompatible: a.incompat || null,
      dificultad: a.dificultad || null,
      vida: a.vida || null,
      notas: a.notas || null,
      estado: a.estado || "activo",
      foto_url: a.foto || null,
    })),
    plantas: (S.plants || []).filter((p) => isUuid(p.id) && ecoIds.has(p.ecoId)).map((p) => ({
      id: p.id,
      ecosistema: p.ecoId,
      nombre: p.nombre,
      nombre_cientifico: p.sci || null,
      zona: p.zona || null,
      luz: p.luz || null,
      co2: p.co2 || null,
      estado: p.estado || "estable",
      fecha_ingreso: p.ingreso || null,
      notas: p.notas || null,
    })),
    equipos: (S.equipment || []).filter((q) => isUuid(q.id) && ecoIds.has(q.ecoId)).map((q) => ({
      id: q.id,
      ecosistema: q.ecoId,
      nombre: q.nombre,
      marca: q.marca || null,
      modelo: q.modelo || null,
      tipo: q.tipo || null,
      caudal: q.caudal || null,
      potencia: q.potencia || null,
      fecha_instalacion: q.instalado || null,
      frecuencia_mant_dias: q.freqDias || 30,
      consumibles: q.consumibles || null,
      notas: q.notas || null,
    })),
    parametros: (S.params || []).filter((p) => isUuid(p.id) && ecoIds.has(p.ecoId)).map((p) => ({
      id: p.id,
      ecosistema: p.ecoId,
      clave: p.key,
      valor: p.val,
      fecha: p.fecha,
      metodo: p.metodo || null,
      nota: p.nota || null,
      autor: userId,
    })),
    tareas: (S.tasks || []).filter((t) => isUuid(t.id) && ecoIds.has(t.ecoId)).map((t) => ({
      id: t.id,
      ecosistema: t.ecoId,
      titulo: t.titulo,
      tipo: t.tipo || "mantenimiento",
      frecuencia_dias: t.freqDias || 1,
      hora: time(t.hora),
      instrucciones: t.nota || null,
      activa: t.activa !== false,
      ultima_vez: t.ultimo || null,
    })),
    tareas_log: (S.taskLogs || []).filter((l) => isUuid(l.id) && isUuid(l.taskId) && ecoIds.has(l.ecoId)).map((l) => ({
      id: l.id,
      tarea: l.taskId,
      ecosistema: l.ecoId,
      fecha: l.fecha,
      momento: l.ts || null,
      estado: l.estado || "hecha",
      nota: l.nota || null,
      autor: userId,
    })),
    mediciones_habitante: (S.measurements || []).filter((m) => isUuid(m.id) && isUuid(m.animalId)).map((m) => {
      const animal = animals.find((a) => a.id === m.animalId);
      if (!animal) return null;
      return {
        id: m.id,
        habitante: m.animalId,
        ecosistema: animal.ecoId,
        fecha: m.fecha,
        longitud_cm: m.cm ?? null,
        nota: m.nota || null,
        autor: userId,
      };
    }).filter(Boolean),
    eventos_salud: (S.health || []).filter((h) => isUuid(h.id) && ecoIds.has(h.ecoId)).map((h) => ({
      id: h.id,
      ecosistema: h.ecoId,
      referencia: h.animalRef || null,
      sintomas: h.sintomas || "",
      diagnostico: h.diagnostico || null,
      tratamiento: h.tratamiento || null,
      dosis: h.dosis || null,
      inicio: h.inicio || null,
      fin: h.fin || null,
      resultado: h.resultado || null,
      estado: h.estado || "abierto",
      autor: userId,
    })),
    documentos: (S.docs || []).filter((d) => isUuid(d.id) && ecoIds.has(d.ecoId)).map((d) => ({
      id: d.id,
      ecosistema: d.ecoId,
      titulo: d.titulo,
      tipo: d.tipo || "protocolo",
      cuerpo: d.cuerpo || null,
    })),
    timeline: (S.timeline || []).filter((t) => isUuid(t.id) && ecoIds.has(t.ecoId)).map((t) => ({
      id: t.id,
      ecosistema: t.ecoId,
      fecha: t.fecha,
      tipo: t.tipo || "nota",
      texto: t.texto,
      destacado: !!t.hi,
      autor: userId,
    })),
    alimentaciones: (S.feedLogs || []).filter((f) => isUuid(f.id) && ecoIds.has(f.ecoId)).map((f) => ({
      id: f.id,
      ecosistema: f.ecoId,
      momento: f.ts || null,
      alimento: f.detalle || null,
      estado: "hecha",
      autor: userId,
    })),
    iluminacion: (S.lighting || []).filter((l) => ecoIds.has(l.ecoId)).map((l) => ({
      id: isUuid(l.id) ? l.id : undefined,
      ecosistema: l.ecoId,
      encendido: time(l.on),
      apagado: time(l.off),
      horas: l.horas ?? null,
      intensidad: l.intensidad || null,
      nota: l.nota || null,
    })),
  };
}

export const CHILD_TABLES = [
  "alimentaciones",
  "tareas_log",
  "mediciones_habitante",
  "eventos_salud",
  "timeline",
  "documentos",
  "parametros",
  "iluminacion",
  "equipos_mantenimiento",
  "fotos",
  "alertas",
  "recomendaciones",
  "rangos_referencia",
  "tareas",
  "equipos",
  "plantas",
  "habitantes",
];
