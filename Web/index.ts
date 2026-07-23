import express from 'express';
import path from 'path';
import dotenv from "dotenv";
import mongoose from "mongoose";
import cron from "node-cron";
import compression from "compression";
import adminRoutes from "./routes/admin/index.route";
import clientRoutes from "./routes/client/index.route";
import { domainCDN, pathAdmin } from './configs/variable.config';
import { connectDB } from './configs/database.config';
import cookieParser from "cookie-parser";
import session from "express-session";
import passport from "passport";
import { configureGooglePassport } from './configs/googleOauth.config';
import { configureFacebookPassport } from './configs/facebookOauth.config';
import { Server } from 'socket.io';
import { createServer } from 'node:http';
import { initSocket } from './sockets/index.socket';
import { startJobs } from './jobs/index.job';
import * as adminAuth from './middlewares/admin/auth.middleware';
import { validateEnv } from './configs/env.config';
import { requestLogger } from './middlewares/request-logger.middleware';
import { formatDateTime, formatVND } from './helpers/format.helper';

// Load environment variables
dotenv.config();
validateEnv();

const app = express();
const port = parseInt(process.env.PORT || "3000", 10);

// Initialize Socket.io on Server
const server = createServer(app);
const io = new Server(server, {
  pingInterval: 25000,
  pingTimeout: 60000,
  maxHttpBufferSize: 1e7,
  transports: ["websocket", "polling"],
});

app.use(compression());
app.use(requestLogger);

// Allow parsing of JSON data
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Setup static files directory (With 7 days caching)
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
}));

// Disable cache middleware (applies to dynamic GET requests only)
app.use((req, res, next) => {
  if (req.method === 'GET') {
    // Disable cache
    // - no-store: do not cache anywhere
    // - no-cache: always validate with server before using cache
    // - must-revalidate: if cache is expired, must query the server
    // - private: only cache on the private client browser, not on shared proxies
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');

    // For compatibility with older browsers/proxies
    res.set('Pragma', 'no-cache');

    // Set response expiration to immediate (i.e. browser must revalidate before reusing)
    res.set('Expires', '0');
  }
  next();
});

// Setup views directory and Pug view engine
app.set('views', path.join(__dirname, 'views')); // Pug views directory
app.set('view engine', 'pug'); // Set Pug as view engine

// Create global variables for Pug templates
app.locals.pathAdmin = pathAdmin;
app.locals.domainCDN = domainCDN;
app.locals.getFullUrl = (url: string) => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/client/") || url.startsWith("client/")) return url;
  if (url.startsWith("/images/") || url.startsWith("images/")) return url;
  return `${domainCDN}${url.startsWith("/") ? "" : "/"}${url}`;
};
app.locals.tinymceApiKey = process.env.TINYMCE_API_KEY || '';
app.locals.mapboxToken = process.env.MAPBOX_TOKEN || '';
app.locals.formatDateTime = formatDateTime;
app.locals.formatVND = formatVND;

// Initialize cookie parser
app.use(cookieParser());

// Configure session
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

// 404 handler
app.use((req, res) => {
  if (req.path.startsWith(`/${pathAdmin}`)) {
    adminAuth.verifyToken(req as any, res, () => {
      res.status(404).render("admin/pages/404", { pageTitle: "404 | Admin" });
    });
    return;
  }

  res.status(404).render("client/pages/404", { pageTitle: "404 | Page not found" });
});

// Express error handler (must be after all routes)
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
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

// Graceful shutdown handling
const gracefulShutdown = (signal: string) => {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);

  // Set a shutdown timeout to force exit if closing takes too long
  const shutdownTimeout = setTimeout(() => {
    console.error("Could not close connections in time, forcefully shutting down");
    process.exit(1);
  }, 10000); // 10 seconds timeout

  // 1. Stop receiving new HTTP requests
  server.close(async (err) => {
    if (err) {
      console.error("Error closing server:", err);
      process.exit(1);
    }
    console.log("HTTP server closed.");

    try {
      // 2. Close Socket.io server
      io.close();
      console.log("Socket.io server closed.");

      // 3. Stop cron jobs
      cron.getTasks().forEach(task => task.stop());
      console.log("Cron jobs stopped.");

      // 4. Disconnect from database
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

// Nodemon sends SIGUSR2 on restart — release port cleanly before re-triggering
process.on("SIGUSR2", () => {
  gracefulShutdown("SIGUSR2");
  setTimeout(() => process.kill(process.pid, "SIGUSR2"), 0);
});

// Catch unhandled promise rejections — prevents silent crash in Node.js v15+
process.on("unhandledRejection", (reason: any) => {
  console.error("[UnhandledRejection]", reason?.message || reason);
});