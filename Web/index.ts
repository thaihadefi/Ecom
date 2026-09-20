import express from 'express';
import axios from 'axios';
import path from 'path';
import { Readable } from 'node:stream';
import dotenv from "dotenv";
import mongoose from "mongoose";
import cron from "node-cron";
import compression from "compression";
import adminRoutes from "./routes/admin/index.route";
import clientRoutes from "./routes/client/index.route";
import { pathAdmin, domainCDN, mediaBase } from './configs/variable.config';
import { connectDB } from './configs/database.config';
import { getGeneral } from './configs/setting.config';
import cookieParser from "cookie-parser";
import passport from "passport";
import { configureGooglePassport } from './configs/googleOauth.config';
import { configureFacebookPassport } from './configs/facebookOauth.config';
import { RequestAccount } from './interfaces/request.interface';
import { Server } from 'socket.io';
import { createServer } from 'node:http';
import { initSocket, stopSocket } from './sockets/index.socket';
import { startJobs } from './jobs/index.job';
import * as adminAuth from './middlewares/admin/auth.middleware';
import { validateEnv } from './configs/env.config';
import { requestLogger } from './middlewares/request-logger.middleware';
import { formatDate, formatDateTime, formatVND } from './helpers/format.helper';
import { safeHtml, safeJson, safeUrl, safeColor } from './helpers/html-sanitize.helper';

dotenv.config();
validateEnv();

axios.defaults.timeout = 15000;

const app = express();
app.disable('x-powered-by');
const port = parseInt(process.env.PORT || "3000", 10);

const server = createServer(app);
const io = new Server(server, {
  pingInterval: 25000,
  pingTimeout: 60000,
  maxHttpBufferSize: 1e6,
  transports: ["websocket", "polling"],
});

app.use(compression());

app.use((_req, res, next) => {
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});
app.use(requestLogger);

app.use((req, res, next) => {
  if (req.path === `/${pathAdmin}` || req.path.startsWith(`/${pathAdmin}/`)) {
    next();
    return;
  }
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// The API documentation changes with the specification, so browsers revalidate it (ETag) instead of caching it for a week.
app.use('/api-docs', express.static(path.join(process.cwd(), 'public', 'api-docs'), { maxAge: 0 }));

app.use(express.static(path.join(process.cwd(), 'public'), {
  maxAge: 7 * 24 * 60 * 60 * 1000
}));

app.use('/admin/assets/libs/tinymce', express.static(path.join(process.cwd(), 'node_modules', 'tinymce'), {
  maxAge: 7 * 24 * 60 * 60 * 1000,
  index: false,
  dotfiles: 'deny'
}));

app.get('/manifest.webmanifest', async (_req, res) => {
  try {
    const general = await getGeneral();
    const name = (general?.websiteName || '').trim() || 'Ecom Store';
    const iconUrl = general?.favicon
      ? `${mediaBase}${general.favicon}`
      : '/images/favicon.ico';

    const spaceIdx = name.lastIndexOf(' ', 12);
    const shortName = name.length > 12
      ? name.slice(0, spaceIdx <= 0 ? 12 : spaceIdx).trim()
      : name;

    const iconUrlLower = iconUrl.toLowerCase();
    const iconMimeType = iconUrlLower.endsWith('.ico')
      ? 'image/x-icon'
      : iconUrlLower.endsWith('.svg')
        ? 'image/svg+xml'
        : iconUrlLower.endsWith('.webp')
          ? 'image/webp'
          : iconUrlLower.endsWith('.jpg') || iconUrlLower.endsWith('.jpeg')
            ? 'image/jpeg'
            : 'image/png';

    const manifest = {
      name,
      short_name: shortName,
      description: `${name} - Online Shopping`,
      start_url: '/',
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: '#0057B7',
      icons: [
        { src: iconUrl, sizes: '192x192', type: iconMimeType, purpose: 'any' },
        { src: iconUrl, sizes: '512x512', type: iconMimeType, purpose: 'any' },
      ],
    };

    res.set('Content-Type', 'application/manifest+json');
    res.set('Cache-Control', 'public, max-age=86400');
    res.json(manifest);
  } catch (err) {
    console.error('[PWA] manifest error:', err instanceof Error ? err.message : err);
    res.status(500).json({});
  }
});

app.get(/^\/+media\//, async (req, res) => {
  const upstreamPath = req.originalUrl.replace(/^\/+/, "/");
  try {
    const upstream = await fetch(`${domainCDN}${upstreamPath}`, { signal: AbortSignal.timeout(15000) });
    res.status(upstream.status);
    const contentType = upstream.headers.get("content-type");
    if (contentType) res.type(contentType);
    const contentDisposition = upstream.headers.get("content-disposition");
    if (contentDisposition) res.set("Content-Disposition", contentDisposition);
    res.set("X-Content-Type-Options", "nosniff");

    res.set("Cache-Control", upstream.ok ? "public, max-age=31536000, immutable" : "no-store");
    if (upstream.body) {
      Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]).pipe(res);
    } else {
      res.end();
    }
  } catch (err) {
    console.error("[Media] proxy to FileManager failed:", err instanceof Error ? err.message : err);
    res.status(502).end();
  }
});

app.use((req, res, next) => {
  if (req.method === 'GET') {
    res.set('Cache-Control', 'private, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
  next();
});

app.set('views', path.join(process.cwd(), 'views'));
app.set('view engine', 'pug');
app.enable('view cache');

const trustProxyEnv = process.env.TRUST_PROXY;
app.set('trust proxy', trustProxyEnv === undefined
  ? (process.env.NODE_ENV === 'production' ? 1 : false)
  : (Number.isNaN(Number(trustProxyEnv)) ? trustProxyEnv : Number(trustProxyEnv)));


const buildFullUrl = (cdn: string, url?: string): string => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/client/") || url.startsWith("client/")) return url;
  if (url.startsWith("/images/") || url.startsWith("images/")) return url;
  return `${cdn}${url.startsWith("/") ? "" : "/"}${url}`;
};

app.locals.pathAdmin = pathAdmin;
app.locals.domainCDN = mediaBase;
app.locals.getFullUrl = (url: string) => buildFullUrl(mediaBase, url);
app.locals.formatDate = formatDate;
app.locals.formatDateTime = formatDateTime;
app.locals.formatVND = formatVND;
app.locals.safeHtml = safeHtml;
app.locals.safeJson = safeJson;
app.locals.safeUrl = safeUrl;
app.locals.safeColor = safeColor;

app.use(cookieParser());

app.use(passport.initialize());

app.use(`/${pathAdmin}`, adminRoutes);
app.use("/", clientRoutes);

app.use((req, res) => {
  if (req.path.startsWith(`/${pathAdmin}`)) {
    adminAuth.verifyToken(req as RequestAccount, res, () => {
      res.status(404).render("admin/pages/404", { pageTitle: "404 | Admin" });
    });
    return;
  }

  res.status(404).render("client/pages/404", { pageTitle: "404 | Page not found" });
});

app.use((err: { name?: string; message?: string; status?: number; statusCode?: number }, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[UnhandledError]', err?.message || err);
  if (res.headersSent) return;
  const isUploadError = err.name === 'MulterError' || err.name === 'UploadRejectedError';
  const status = isUploadError ? 400 : (err.status || err.statusCode || 500);
  const isApiRequest = isUploadError || req.xhr || req.originalUrl.includes('/api/') || (req.headers.accept || '').includes('application/json');
  if (isApiRequest) {
    const message = status < 500 && err.message ? err.message : 'Internal Server Error';
    res.status(status).json({ code: 'error', message });
  } else {
    res.status(status).render('client/pages/404', { pageTitle: `${status} | Error` });
  }
});

const bootstrap = async () => {
  try {
    await connectDB();
    await configureGooglePassport(passport);
    await configureFacebookPassport(passport);
  } catch {
    console.error("[Bootstrap] Database connection failed. Exiting.");
    process.exit(1);
  }

  initSocket(io);
  startJobs();

  server.listen(port, "0.0.0.0", () => {
    console.log(`Website is running on port ${port}`);
  });
};

bootstrap();

const gracefulShutdown = (signal: string) => {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);

  const shutdownTimeout = setTimeout(() => {
    console.error("Could not close connections in time, forcefully shutting down");
    process.exit(1);
  }, 10000);

  server.close(async (err) => {
    if (err) {
      console.error("Error closing server:", err);
      process.exit(1);
    }
    console.log("HTTP server closed.");

    try {
      stopSocket();
      io.close();
      console.log("Socket.io server closed.");

      cron.getTasks().forEach(task => task.stop());
      console.log("Cron jobs stopped.");

      await mongoose.disconnect();
      console.log("Database disconnected.");

      clearTimeout(shutdownTimeout);
      console.log("Graceful shutdown completed successfully.");
      process.exit(0);
    } catch (error) {
      console.error("Error during graceful shutdown:", error);
      process.exit(1);
    }
  });
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

process.on("SIGUSR2", () => {
  gracefulShutdown("SIGUSR2");
  setTimeout(() => process.kill(process.pid, "SIGUSR2"), 0);
});

process.on("unhandledRejection", (reason: unknown) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  console.error("[UnhandledRejection]", msg);
});
