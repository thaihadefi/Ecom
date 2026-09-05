import express from 'express';
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
import cookieParser from "cookie-parser";
import session from "express-session";
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
import { formatDateTime, formatVND } from './helpers/format.helper';

dotenv.config();
validateEnv();

const app = express();
const port = parseInt(process.env.PORT || "3000", 10);

const server = createServer(app);
const io = new Server(server, {
  pingInterval: 25000,
  pingTimeout: 60000,
  maxHttpBufferSize: 1e6, // 1 MB — chat payloads are text + short file paths; uploads go over HTTP
  transports: ["websocket", "polling"],
});

app.use(compression());
app.use(requestLogger);

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

app.use(express.static(path.join(process.cwd(), 'public'), {
  maxAge: 7 * 24 * 60 * 60 * 1000
}));

app.get(/^\/+media\//, async (req, res) => {
  const upstreamPath = req.originalUrl.replace(/^\/+/, "/"); // collapse any leading //
  try {
    const upstream = await fetch(`${domainCDN}${upstreamPath}`);
    res.status(upstream.status);
    const contentType = upstream.headers.get("content-type");
    if (contentType) res.type(contentType);
    
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
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
  next();
});

app.set('views', path.join(process.cwd(), 'views'));
app.set('view engine', 'pug');

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
app.locals.tinymceApiKey = process.env.TINYMCE_API_KEY || '';
app.locals.formatDateTime = formatDateTime;
app.locals.formatVND = formatVND;

app.use(cookieParser());

app.use(session({
  secret: `${process.env.SESSION_SECRET}`,
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  }
}));

app.use(passport.initialize());
app.use(passport.session());

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

app.use((err: { message?: string; status?: number; statusCode?: number }, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[UnhandledError]', err?.message || err);
  if (res.headersSent) return;
  const status = err.status || err.statusCode || 500;
  const isApiRequest = req.xhr || (req.headers.accept || '').includes('application/json');
  if (isApiRequest) {
    res.status(status).json({ code: 'error', message: err.message || 'Internal Server Error' });
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
