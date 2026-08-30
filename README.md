# BIOMA · sistema operativo de ecosistemas

Aplicación de gestión para acuarios y terrarios. El navegador solo habla con `/api/*` en el mismo origen. Las claves de Supabase viven en el servidor (`.env.local`), nunca en el HTML.

La sesión va en cookies `httpOnly`. El cliente de Supabase usa el JWT del usuario, así que aplica RLS. No hay `service_role` en el navegador.

## Contenido del repo

| Archivo | Qué es |
|---|---|
| `index.html` | La aplicación. Login y datos van por `/api`. |
| `api/` | Login, sesión, logout y persistencia del estado. |
| `supabase/schema.sql` | Esquema PostgreSQL con RLS, auditoría y vistas. |
| `.env.example` | Variables de servidor (vacías). Copia a `.env.local`. |
| `vercel.json` | `cleanUrls` y `no-store` en `/api`. |

## Uso local

```bash
cp .env.example .env.local
# rellena SUPABASE_URL y SUPABASE_ANON_KEY (solo servidor)
npm install
npm run dev
```

Abre `http://127.0.0.1:3000`. Entra con un usuario de Auth de ese proyecto. Si la cuenta no tiene ecosistemas, se siembra el ejemplo del 600 L y se guarda en la base.

## Variables de entorno

Solo servidor. No uses prefijos `NEXT_PUBLIC_` ni las pongas en `index.html`.

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (anon / publishable; no la service role)

## Deploy

En Vercel: mismas variables en el proyecto, Framework *Other*, raíz del repo. Las funciones de `/api` se publican solas.

## Qué hace

**Hoy.** Pendiente de todos los ecosistemas, ordenado por hora.

**Ecosistemas.** Fichas con habitantes, plantas, equipos, parámetros, tareas, salud, diario y documentación.

**Modo cuidador.** Checklist diaria, prohibiciones y Markdown exportable.

**Asistente.** Responde con los datos registrados. Si un dato no existe, lo dice.

## Al abrirla por primera vez

1. Registrar la temperatura del acuario de 600 L.
2. Corregir la fecha de montaje si no fue hace dos días.
3. Anotar la tapa en Equipamiento cuando esté instalada.
4. Segunda medida de bichir, cuchillo y Ctenopoma en tres o cuatro semanas.
