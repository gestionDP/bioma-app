import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const envFile = join(root, ".env.local");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim();
    if (k && process.env[k] == null) process.env[k] = v;
  }
}

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".md": "text/markdown; charset=utf-8",
};

const routes = {
  "/api/auth/login": "api/auth/login.js",
  "/api/auth/logout": "api/auth/logout.js",
  "/api/auth/session": "api/auth/session.js",
  "/api/state": "api/state.js",
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  const file = routes[url.pathname];
  if (file) {
    const mod = await import(pathToFileURL(join(root, file)).href + `?t=${Date.now()}`);
    return mod.default(req, res);
  }
  let path = url.pathname === "/" ? "/index.html" : url.pathname;
  const resolved = normalize(join(root, path));
  const rootNorm = normalize(root);
  const rel = resolved.slice(rootNorm.length).replace(/^\/+/, "");
  const parts = rel.split("/").filter(Boolean);
  const blocked = parts.some((p) => p.startsWith(".")) || parts[0] === "api" || parts.includes("node_modules");
  if (!resolved.startsWith(rootNorm) || blocked) {
    res.statusCode = 403;
    return res.end();
  }
  if (!existsSync(resolved)) {
    res.statusCode = 404;
    return res.end("Not found");
  }
  res.setHeader("Content-Type", TYPES[extname(resolved)] || "application/octet-stream");
  res.end(readFileSync(resolved));
});

const port = Number(process.env.PORT || 3000);
server.listen(port, "127.0.0.1", () => {
  console.log(`Bioma local en http://127.0.0.1:${port}`);
});
