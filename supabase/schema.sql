-- ============================================================
-- BIOMA · esquema PostgreSQL para Supabase
-- Entrega 2: versión multiusuario en la nube.
-- Ejecutar en el SQL Editor de Supabase, de arriba abajo.
-- Principio: nada se sobrescribe. Todo lo relevante es un evento fechado.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- tipos ----------
create type eco_tipo    as enum ('acuario','terrario','paludario','acuaterrario','otro');
create type eco_estado  as enum ('idea','planificado','montaje','ciclando','activo','cuarentena','archivado');
create type rol         as enum ('owner','cuidador','viewer');
create type ident       as enum ('confirmado','probable','pendiente');
create type an_estado   as enum ('activo','observacion','cuarentena','tratamiento','trasladado','fallecido');
create type an_clase    as enum ('pez','anfibio','reptil','crustaceo','molusco','insecto','otro');
create type tarea_tipo  as enum ('alimentacion','mantenimiento','parametros','observacion','seguridad','crecimiento','salud');
create type log_estado  as enum ('hecha','parcial','omitida','pospuesta');
create type nivel       as enum ('info','advertencia','critica');

-- ---------- perfiles ----------
create table perfiles (
  id uuid primary key references auth.users on delete cascade,
  nombre text not null,
  email text,
  creado timestamptz default now()
);

-- ---------- ecosistemas ----------
create table ecosistemas (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references perfiles(id) on delete cascade,
  nombre text not null,
  tipo eco_tipo not null default 'acuario',
  subtitulo text,
  litros numeric,
  largo_cm numeric, fondo_cm numeric, alto_cm numeric,
  estado eco_estado not null default 'montaje',
  fecha_montaje date,
  concepto text, sustrato text, hardscape text, ubicacion text,
  color text default '#7FD1A6',
  dims text,
  foto_url text,
  creado timestamptz default now()
);

create table ecosistema_miembros (
  ecosistema uuid references ecosistemas on delete cascade,
  usuario uuid references perfiles on delete cascade,
  rol rol not null default 'cuidador',
  desde timestamptz default now(),
  primary key (ecosistema, usuario)
);

-- función de acceso reutilizada por todas las políticas
create or replace function tiene_acceso(eco uuid) returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (select 1 from ecosistemas e where e.id = eco and e.owner = auth.uid())
      or exists (select 1 from ecosistema_miembros m where m.ecosistema = eco and m.usuario = auth.uid());
$$;

create or replace function puede_escribir(eco uuid) returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (select 1 from ecosistemas e where e.id = eco and e.owner = auth.uid())
      or exists (select 1 from ecosistema_miembros m
                 where m.ecosistema = eco and m.usuario = auth.uid() and m.rol = 'cuidador');
$$;

create or replace function es_owner(eco uuid) returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (select 1 from ecosistemas e where e.id = eco and e.owner = auth.uid());
$$;

-- ---------- catálogo de especies ----------
create table especies (
  id uuid primary key default gen_random_uuid(),
  nombre_comun text not null,
  nombre_cientifico text,
  clase an_clase not null default 'pez',
  talla_adulta_cm numeric,
  vida text,
  zona text,
  dieta text,
  comportamiento text,
  parametros_ideales jsonb,
  dificultad text,
  publica boolean default true,
  creado_por uuid references perfiles(id)
);

-- ---------- habitantes ----------
create table habitantes (
  id uuid primary key default gen_random_uuid(),
  ecosistema uuid not null references ecosistemas on delete cascade,
  especie uuid references especies(id),
  nombre text not null,
  nombre_cientifico text,
  identificacion ident not null default 'pendiente',
  clase an_clase not null default 'pez',
  cantidad int not null default 1,
  sexo text,
  zona text,
  nocturno boolean default false,
  talla_actual_cm numeric,
  talla_adulta_cm numeric,
  fecha_ingreso date default current_date,
  procedencia text,
  dieta text, comportamiento text, compatible text, incompatible text,
  dificultad text, vida text, notas text,
  estado an_estado not null default 'activo',
  foto_url text,
  creado timestamptz default now()
);

create table mediciones_habitante (   -- crecimiento
  id uuid primary key default gen_random_uuid(),
  habitante uuid not null references habitantes on delete cascade,
  ecosistema uuid not null references ecosistemas on delete cascade,
  fecha date not null default current_date,
  longitud_cm numeric,
  peso_g numeric,
  estado_corporal text,
  nota text,
  foto_url text,
  autor uuid references perfiles(id),
  creado timestamptz default now()
);

create table eventos_salud (
  id uuid primary key default gen_random_uuid(),
  ecosistema uuid not null references ecosistemas on delete cascade,
  habitante uuid references habitantes(id),
  referencia text,
  sintomas text not null,
  diagnostico text,
  tratamiento text,
  dosis text,
  inicio date default current_date,
  fin date,
  resultado text,
  estado text default 'abierto',
  autor uuid references perfiles(id),
  creado timestamptz default now()
);

-- ---------- plantas ----------
create table plantas (
  id uuid primary key default gen_random_uuid(),
  ecosistema uuid not null references ecosistemas on delete cascade,
  nombre text not null,
  nombre_cientifico text,
  identificacion ident default 'pendiente',
  zona text, luz text, co2 text, nutrientes text,
  estado text default 'estable',
  fecha_ingreso date default current_date,
  notas text, foto_url text
);
create table plantas_log (
  id uuid primary key default gen_random_uuid(),
  planta uuid not null references plantas on delete cascade,
  fecha date default current_date,
  accion text,            -- poda, abono, replantado
  estado text, nota text, foto_url text,
  autor uuid references perfiles(id)
);

-- ---------- equipamiento ----------
create table equipos (
  id uuid primary key default gen_random_uuid(),
  ecosistema uuid not null references ecosistemas on delete cascade,
  nombre text not null, marca text, modelo text, tipo text,
  caudal text, potencia text, consumibles text,
  fecha_instalacion date, garantia_hasta date,
  frecuencia_mant_dias int default 30,
  manual_url text, notas text
);
create table equipos_mantenimiento (
  id uuid primary key default gen_random_uuid(),
  equipo uuid not null references equipos on delete cascade,
  ecosistema uuid not null references ecosistemas on delete cascade,
  fecha date default current_date,
  descripcion text,
  autor uuid references perfiles(id)
);

-- ---------- parámetros ----------
create table parametros (
  id uuid primary key default gen_random_uuid(),
  ecosistema uuid not null references ecosistemas on delete cascade,
  clave text not null,               -- temp, ph, tds, gh, kh, nh3, no2, no3, hum, tcaliente, tfria, uvi...
  valor numeric not null,
  unidad text,
  fecha date not null default current_date,
  hora time default current_time,
  metodo text,
  nota text,
  foto_url text,
  autor uuid references perfiles(id),
  creado timestamptz default now()
);
create index on parametros (ecosistema, clave, fecha desc);

create table rangos_referencia (
  ecosistema uuid references ecosistemas on delete cascade,
  clave text,
  minimo numeric, maximo numeric,
  primary key (ecosistema, clave)
);

-- ---------- tareas ----------
create table tareas (
  id uuid primary key default gen_random_uuid(),
  ecosistema uuid not null references ecosistemas on delete cascade,
  titulo text not null,
  tipo tarea_tipo not null default 'mantenimiento',
  frecuencia_dias int not null default 1,
  hora time,
  instrucciones text,
  activa boolean default true,
  ultima_vez date,
  creado timestamptz default now()
);
create table tareas_log (
  id uuid primary key default gen_random_uuid(),
  tarea uuid not null references tareas on delete cascade,
  ecosistema uuid not null references ecosistemas on delete cascade,
  fecha date not null default current_date,
  momento timestamptz default now(),
  estado log_estado not null default 'hecha',
  nota text,
  autor uuid references perfiles(id)
);
create unique index on tareas_log (tarea, fecha);   -- evita el doble registro del mismo día

create table alimentaciones (
  id uuid primary key default gen_random_uuid(),
  ecosistema uuid not null references ecosistemas on delete cascade,
  habitante uuid references habitantes(id),
  momento timestamptz default now(),
  alimento text,
  cantidad text,
  estado log_estado default 'hecha',
  nota text,
  autor uuid references perfiles(id)
);

-- ---------- iluminación ----------
create table iluminacion (
  id uuid primary key default gen_random_uuid(),
  ecosistema uuid not null references ecosistemas on delete cascade,
  encendido time, apagado time, horas numeric, intensidad text,
  amanecer_min int, atardecer_min int, nota text,
  desde date default current_date
);

-- ---------- contenido ----------
create table fotos (
  id uuid primary key default gen_random_uuid(),
  ecosistema uuid not null references ecosistemas on delete cascade,
  habitante uuid references habitantes(id),
  planta uuid references plantas(id),
  url text not null, titulo text, fecha date default current_date,
  autor uuid references perfiles(id)
);
create table documentos (
  id uuid primary key default gen_random_uuid(),
  ecosistema uuid references ecosistemas on delete cascade,
  titulo text not null, tipo text default 'protocolo', cuerpo text,
  archivo_url text, creado timestamptz default now()
);
create table timeline (
  id uuid primary key default gen_random_uuid(),
  ecosistema uuid not null references ecosistemas on delete cascade,
  fecha date default current_date,
  tipo text, texto text not null, destacado boolean default false,
  autor uuid references perfiles(id)
);

-- ---------- IA ----------
create table ia_conversaciones (
  id uuid primary key default gen_random_uuid(),
  ecosistema uuid references ecosistemas on delete cascade,
  usuario uuid references perfiles(id),
  titulo text, creado timestamptz default now()
);
create table ia_mensajes (
  id uuid primary key default gen_random_uuid(),
  conversacion uuid not null references ia_conversaciones on delete cascade,
  rol text not null,          -- user | assistant
  contenido text not null,
  fuentes jsonb,
  creado timestamptz default now()
);
-- para cuando el histórico crezca lo suficiente como para necesitar recuperación
-- create extension if not exists vector;
-- create table fragmentos (
--   id uuid primary key default gen_random_uuid(),
--   ecosistema uuid references ecosistemas on delete cascade,
--   origen text, texto text, embedding vector(1536)
-- );

create table recomendaciones (
  id uuid primary key default gen_random_uuid(),
  ecosistema uuid not null references ecosistemas on delete cascade,
  titulo text not null, motivo text, evidencia text, accion text,
  urgencia nivel default 'info',
  vigente boolean default true,
  creado timestamptz default now()
);
create table alertas (
  id uuid primary key default gen_random_uuid(),
  ecosistema uuid not null references ecosistemas on delete cascade,
  nivel nivel not null default 'info',
  texto text not null, motivo text,
  resuelta boolean default false,
  creado timestamptz default now()
);

-- ---------- modo cuidador ----------
create table periodos_cuidador (
  id uuid primary key default gen_random_uuid(),
  ecosistema uuid references ecosistemas on delete cascade,
  cuidador uuid references perfiles(id),
  nombre_cuidador text,
  desde date, hasta date, activo boolean default true,
  contacto text
);
create table instrucciones_cuidador (
  id uuid primary key default gen_random_uuid(),
  periodo uuid references periodos_cuidador on delete cascade,
  texto text not null,
  prohibido boolean default false,
  orden int default 0
);

-- ---------- auditoría ----------
create table auditoria (
  id bigserial primary key,
  ecosistema uuid,
  tabla text, registro uuid,
  accion text,                -- INSERT | UPDATE | DELETE
  valor_anterior jsonb, valor_nuevo jsonb,
  autor uuid references perfiles(id),
  momento timestamptz default now()
);

create or replace function fn_auditoria() returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into auditoria (ecosistema, tabla, registro, accion, valor_anterior, valor_nuevo, autor)
  values (
    coalesce((to_jsonb(new)->>'ecosistema')::uuid, (to_jsonb(old)->>'ecosistema')::uuid),
    tg_table_name,
    coalesce((to_jsonb(new)->>'id')::uuid, (to_jsonb(old)->>'id')::uuid),
    tg_op,
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end,
    auth.uid()
  );
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['habitantes','parametros','tareas_log','alimentaciones','eventos_salud','equipos_mantenimiento','mediciones_habitante']
  loop
    execute format('create trigger tr_audit_%1$s after insert or update or delete on %1$s
                    for each row execute function fn_auditoria();', t);
  end loop;
end $$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table perfiles              enable row level security;
alter table ecosistemas           enable row level security;
alter table ecosistema_miembros   enable row level security;
alter table especies              enable row level security;

create policy "perfil propio" on perfiles
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy "ver ecosistemas accesibles" on ecosistemas
  for select using (
    owner = auth.uid()
    or exists (
      select 1 from ecosistema_miembros m
      where m.ecosistema = id and m.usuario = auth.uid()
    )
  );
create policy "crear ecosistema propio" on ecosistemas
  for insert with check (owner = auth.uid());
create policy "editar solo owner" on ecosistemas
  for update using (owner = auth.uid());
create policy "borrar solo owner" on ecosistemas
  for delete using (owner = auth.uid());

create policy "ver miembros" on ecosistema_miembros
  for select using (tiene_acceso(ecosistema));
create policy "gestionar miembros solo owner" on ecosistema_miembros
  for all using (es_owner(ecosistema)) with check (es_owner(ecosistema));

create policy "especies visibles" on especies for select using (publica or creado_por = auth.uid());
create policy "crear especie" on especies for insert with check (auth.uid() is not null);

-- políticas uniformes para todas las tablas colgadas de un ecosistema
do $$
declare t text;
begin
  foreach t in array array[
    'habitantes','mediciones_habitante','eventos_salud','plantas','equipos','equipos_mantenimiento',
    'parametros','rangos_referencia','tareas','tareas_log','alimentaciones','iluminacion',
    'fotos','documentos','timeline','recomendaciones','alertas','periodos_cuidador'
  ] loop
    execute format('alter table %I enable row level security;', t);
    execute format('create policy "leer %1$s" on %1$I for select using (tiene_acceso(ecosistema));', t);
    execute format('create policy "crear %1$s" on %1$I for insert with check (puede_escribir(ecosistema));', t);
    execute format('create policy "actualizar %1$s" on %1$I for update using (puede_escribir(ecosistema));', t);
    -- el borrado queda reservado al propietario: el cuidador nunca destruye histórico
    execute format('create policy "borrar %1$s" on %1$I for delete using (es_owner(ecosistema));', t);
  end loop;
end $$;

alter table auditoria enable row level security;
create policy "auditoria solo owner" on auditoria for select using (ecosistema is null or es_owner(ecosistema));

alter table ia_conversaciones enable row level security;
alter table ia_mensajes enable row level security;
create policy "mis conversaciones" on ia_conversaciones for all
  using (usuario = auth.uid()) with check (usuario = auth.uid());
create policy "mis mensajes" on ia_mensajes for all
  using (exists (select 1 from ia_conversaciones c where c.id = conversacion and c.usuario = auth.uid()))
  with check (exists (select 1 from ia_conversaciones c where c.id = conversacion and c.usuario = auth.uid()));

alter table plantas_log enable row level security;
create policy "leer plantas_log" on plantas_log for select
  using (exists (select 1 from plantas p where p.id = planta and tiene_acceso(p.ecosistema)));
create policy "escribir plantas_log" on plantas_log for insert
  with check (exists (select 1 from plantas p where p.id = planta and puede_escribir(p.ecosistema)));

alter table instrucciones_cuidador enable row level security;
create policy "leer instrucciones" on instrucciones_cuidador for select
  using (exists (select 1 from periodos_cuidador p where p.id = periodo and tiene_acceso(p.ecosistema)));
create policy "escribir instrucciones" on instrucciones_cuidador for all
  using (exists (select 1 from periodos_cuidador p where p.id = periodo and es_owner(p.ecosistema)))
  with check (exists (select 1 from periodos_cuidador p where p.id = periodo and es_owner(p.ecosistema)));

-- ---------- perfil automático al registrarse ----------
create or replace function fn_nuevo_usuario() returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into perfiles (id, nombre, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email,'@',1)), new.email);
  return new;
end $$;
create trigger tr_nuevo_usuario after insert on auth.users
  for each row execute function fn_nuevo_usuario();

-- ---------- vistas de apoyo ----------
create or replace view v_ultimo_parametro
with (security_invoker = true) as
select distinct on (ecosistema, clave)
  ecosistema, clave, valor, unidad, fecha, autor
from parametros order by ecosistema, clave, fecha desc, creado desc;

create or replace view v_tareas_pendientes
with (security_invoker = true) as
select t.*,
  coalesce(t.ultima_vez + t.frecuencia_dias, current_date) as proxima,
  current_date - coalesce(t.ultima_vez + t.frecuencia_dias, current_date) as dias_retraso
from tareas t where t.activa;

create or replace view v_censo
with (security_invoker = true) as
select ecosistema, sum(cantidad) as animales, count(*) as fichas
from habitantes where estado not in ('fallecido','trasladado')
group by ecosistema;

-- ============================================================
-- SEMILLA · Acuario 600 L (del Documento Maestro)
-- Sustituye :OWNER por el uuid de tu usuario tras el primer registro.
-- ============================================================
-- insert into ecosistemas (id, owner, nombre, tipo, subtitulo, litros, largo_cm, fondo_cm, alto_cm,
--   estado, fecha_montaje, concepto, sustrato, hardscape, ubicacion)
-- values ('11111111-1111-1111-1111-111111111111', ':OWNER', 'Acuario 600 L', 'acuario',
--   'Dulce · selva inundada', 600, 120, 75, 75, 'ciclando', current_date - 2,
--   'Selva inundada / predator · oddball. Pocos protagonistas, mucha madera, Dragon Stone, corredor central abierto.',
--   'Soil negro activo (referencia: Oase Scaper Soil)',
--   'Dragon Stone + raíces grandes; raíz diagonal central', 'Casa, Mallorca');
--
-- insert into habitantes (ecosistema, nombre, nombre_cientifico, identificacion, cantidad, zona,
--   talla_actual_cm, talla_adulta_cm, nocturno, dieta, comportamiento) values
-- ('11111111-1111-1111-1111-111111111111','Bichir albino','Polypterus senegalus (albino)','probable',1,'fondo',8,30,true,
--  'Pellet carnívoro hundible, gamba troceada, lombriz, congelado.','Depredador oportunista, nocturno, respirador aéreo, escapista.'),
-- ('11111111-1111-1111-1111-111111111111','Cuchillo fantasma negro','Apteronotus albifrons','confirmado',1,'media',6,42,true,
--  'Larva roja, artemia, mysis, lombriz, gamba fina.','Nocturno, débilmente eléctrico, necesita refugios oscuros.'),
-- ('11111111-1111-1111-1111-111111111111','Ctenopoma leopardo','Ctenopoma acutirostre','confirmado',1,'media',5,17,false,
--  'Congelados, larvas, artemia, mysis, lombriz, gamba.','Laberíntido africano, depredador de emboscada, salta.'),
-- ('11111111-1111-1111-1111-111111111111','Gourami azul','Trichopodus trichopterus','probable',1,'superficie',null,13,false,
--  'Escama o gránulo de calidad, congelado.','Laberíntido de zona alta, puede volverse territorial.'),
-- ('11111111-1111-1111-1111-111111111111','Pseudomugil amarillo','Pseudomugil furcatus','confirmado',7,'superficie',3,5,false,
--  'Micro gránulo, artemia, congelado fino.','Gregario y activo. Aporta el movimiento del acuario.'),
-- ('11111111-1111-1111-1111-111111111111','Tetra bentosi','Hyphessobrycon bentosi','confirmado',3,'media',3,4.5,false,
--  'Escama, gránulo pequeño, congelado.','Gregario de zona media.'),
-- ('11111111-1111-1111-1111-111111111111','Kuhli','Pangio spp.','pendiente',3,'fondo',6,10,true,
--  'Pastilla hundible, congelado, lombriz fina.','Bentónico, serpentiforme, nocturno.'),
-- ('11111111-1111-1111-1111-111111111111','Gobios (2 azules + 1 arcoíris)','Especie pendiente de identificar','pendiente',3,'fondo',null,null,false,
--  'Congelado, pastilla hundible.','Ocupan roca y fondo.'),
-- ('11111111-1111-1111-1111-111111111111','Ancistrus (2 normales + 1 albino)','Ancistrus sp.','probable',3,'fondo',null,13,true,
--  'Pastilla vegetal, verdura escaldada, madera.','Raspador nocturno, necesita cuevas.');
--
-- insert into parametros (ecosistema, clave, valor, unidad, fecha, metodo) values
-- ('11111111-1111-1111-1111-111111111111','ph',7.82,'',current_date - 1,'medidor digital'),
-- ('11111111-1111-1111-1111-111111111111','tds',439,'ppm',current_date - 1,'medidor digital'),
-- ('11111111-1111-1111-1111-111111111111','no2',0,'mg/L',current_date - 1,'test gotas'),
-- ('11111111-1111-1111-1111-111111111111','nh3',0,'mg/L',current_date - 1,'test gotas');
