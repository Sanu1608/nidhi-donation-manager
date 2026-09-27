// mini-http.js
// A deliberately small, dependency-free stand-in for Express's routing API
// (Router with get/post/put/delete, req.params/query/body, res.json/status).
// Why: it means this whole app runs with nothing but `node server.js` — no
// `npm install`, no risk of a native module failing to build on whatever
// laptop it's demoed on, and no internet connection required at all.

const http = require("http");
const fs = require("fs");
const path = require("path");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

function Router() {
  const routes = [];

  function add(method, routePath, handler) {
    const paramNames = [];
    const segments = routePath.split("/").map((seg) => {
      if (seg.startsWith(":")) {
        paramNames.push(seg.slice(1));
        return "([^/]+)";
      }
      return seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    });
    const regex = new RegExp("^" + (segments.join("/") || "/") + "/?$");
    routes.push({ method, regex, paramNames, handler });
  }

  return {
    get: (p, h) => add("GET", p, h),
    post: (p, h) => add("POST", p, h),
    put: (p, h) => add("PUT", p, h),
    delete: (p, h) => add("DELETE", p, h),
    _match(method, pathname) {
      for (const r of routes) {
        if (r.method !== method) continue;
        const m = r.regex.exec(pathname);
        if (m) {
          const params = {};
          r.paramNames.forEach((name, i) => (params[name] = decodeURIComponent(m[i + 1])));
          return { handler: r.handler, params };
        }
      }
      return null;
    }
  };
}

function decorate(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (obj) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(obj));
  };
  res.send = (body) => {
    if (typeof body === "string") {
      if (!res.getHeader("Content-Type")) res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(body);
    } else {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify(body));
    }
  };
  return res;
}

function readBody(req, cb) {
  if (!["POST", "PUT", "PATCH"].includes(req.method)) {
    req.body = {};
    return cb();
  }
  let data = "";
  req.on("data", (chunk) => (data += chunk));
  req.on("end", () => {
    try {
      req.body = data ? JSON.parse(data) : {};
    } catch {
      req.body = {};
    }
    cb();
  });
}

function createApp() {
  const mounts = [];
  let staticDir = null;

  function serveStatic(res, pathname) {
    if (!staticDir) return res.status(404).json({ error: "Not found" });
    const safeRel = path.normalize(pathname === "/" ? "/index.html" : pathname).replace(/^(\.\.[/\\])+/, "");
    let filePath = path.join(staticDir, safeRel);
    if (!filePath.startsWith(staticDir)) {
      res.statusCode = 403;
      return res.end("Forbidden");
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        // SPA-style fallback: unknown extensionless paths resolve to index.html
        if (path.extname(pathname) === "") {
          return fs.readFile(path.join(staticDir, "index.html"), (e2, data2) => {
            if (e2) {
              res.statusCode = 404;
              return res.end("Not found");
            }
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.end(data2);
          });
        }
        res.statusCode = 404;
        return res.end("Not found");
      }
      res.setHeader("Content-Type", MIME[path.extname(filePath)] || "application/octet-stream");
      res.end(data);
    });
  }

  return {
    use(prefix, router) {
      mounts.push({ prefix: prefix.replace(/\/$/, ""), router });
    },
    serveStatic(dir) {
      staticDir = dir;
    },
    listen(port, cb) {
      const server = http.createServer((req, res) => {
        decorate(res);
        const parsedUrl = new URL(req.url, "http://localhost");
        const pathname = decodeURIComponent(parsedUrl.pathname);
        req.query = Object.fromEntries(parsedUrl.searchParams.entries());

        const mount = mounts.find((m) => pathname === m.prefix || pathname.startsWith(m.prefix + "/"));
        if (mount) {
          let sub = pathname.slice(mount.prefix.length);
          if (sub === "") sub = "/";
          readBody(req, () => {
            const match = mount.router._match(req.method, sub);
            if (!match) return res.status(404).json({ error: "Not found" });
            req.params = match.params;
            try {
              match.handler(req, res);
            } catch (err) {
              console.error(err);
              res.status(500).json({ error: "Internal server error" });
            }
          });
          return;
        }
        if (pathname.startsWith("/api/")) {
          return res.status(404).json({ error: "Not found" });
        }
        serveStatic(res, pathname);
      });
      server.listen(port, cb);
      return server;
    }
  };
}

module.exports = { createApp, Router };
