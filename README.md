# BIOMA · sistema operativo de ecosistemas

Aplicación de gestión para acuarios, terrarios y futuros ecosistemas. Un solo HTML: se abre en local o se sirve como página estática.

Los datos viven en el dispositivo (`localStorage`). No hay cuenta ni servidor en esta versión.

## Contenido del repo

| Archivo | Qué es |
|---|---|
| `index.html` | La aplicación. Lista para abrir o desplegar. |
| `supabase/schema.sql` | Esquema PostgreSQL con RLS, auditoría y vistas (versión en la nube, entrega 2). |
| `vercel.json` | Config mínima para un deploy estático en Vercel. |

## Uso local

Abre `index.html` en el navegador, o sirve la carpeta:

```bash
npx --yes serve .
```

En el móvil: súbela a una URL, ábrela en Safari o Chrome y *Compartir → Añadir a pantalla de inicio*.

Desde *Ajustes* puedes exportar una copia completa en JSON y restaurarla en otro dispositivo.

## Deploy

Cualquier host estático sirve este repo tal cual (la raíz es `index.html`).

**Vercel** (después de tener el remote en GitHub):

```bash
npx --yes vercel
```

O importa el repo en [vercel.com/new](https://vercel.com/new). Framework preset: *Other*. Output: la raíz del repo.

**Netlify:** *Add new site → Import an existing project* y apunta a este repo. Build command vacío; publish directory `.`

**GitHub Pages:** Settings → Pages → Deploy from a branch → `main` / `/ (root)`.

## Qué hace

**Hoy.** Pendiente de todos los ecosistemas, ordenado por hora. Un toque marca la tarea como hecha.

**Ecosistemas.** Cuatro fichas de ejemplo: acuario 600 L, 18 L, terrario de camaleón pantera (planificado) y gambario (idea). Cada una tiene once secciones.

**Habitantes.** Fichas con sello de identificación (`confirmado` / `probable` / `pendiente`) y bloque de compatibilidad.

**Plantas, Equipamiento, Parámetros, Alimentación, Mantenimiento, Iluminación, Salud, Diario, Documentación.** CRUD y gráficas cuando hay dos lecturas.

**Modo cuidador.** Checklist diaria, prohibiciones y Markdown exportable.

**Asistente.** Responde con los datos registrados. Si un dato no existe, lo dice; no lo estima. El fallback a la API de Anthropic no está cableado en esta versión estática.

## Motores

- **Tareas.** Frecuencia en días + última ejecución → próxima fecha y retraso.
- **Compatibilidad futura.** Talla adulta de la presa / 0,35 ≈ talla a la que el depredador es un problema; con ritmo medido, se traduce a meses.
- **Avisos.** Rangos, tendencias, tareas vencidas, IDs pendientes y riesgo de depredación. Siempre con motivo.

## Versión en la nube (entrega 2)

`supabase/schema.sql` modela 25 tablas, auditoría y tres roles. El cuidador puede anotar; el `DELETE` queda reservado al propietario.

Pasos previstos: crear proyecto en Supabase, ejecutar el SQL, registrar el primer usuario (el trigger crea el perfil) y, más adelante, portar esto a Next.js. Las claves (`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`) van solo en el servidor.

## Al abrirla por primera vez

1. Registrar la temperatura del acuario de 600 L.
2. Corregir la fecha de montaje si no fue hace dos días.
3. Anotar la tapa en Equipamiento cuando esté instalada.
4. Segunda medida de bichir, cuchillo y Ctenopoma en tres o cuatro semanas.
