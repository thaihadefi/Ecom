// Load .env before any module below reads process.env at import time.
import 'dotenv/config';
import mongoose from "mongoose";
import passport from "passport";
import { server, io } from './app';
import { connectDB } from './configs/database.config';
import { configureGooglePassport } from './configs/googleOauth.config';
import { configureFacebookPassport } from './configs/facebookOauth.config';
import { initSocket, stopSocket } from './sockets/index.socket';
import { startJobs } from './jobs/index.job';
import { stopJobs } from './jobs/scheduler';
import { FEATURES } from './configs/features.config';
import { loadStorefront } from './configs/storefront.config';

const port = parseInt(process.env.PORT || "3000", 10);

const bootstrap = async () => {
  try {
    await connectDB();
    await loadStorefront();
    await configureGooglePassport(passport);
    await configureFacebookPassport(passport);
  } catch {
    console.error("[Bootstrap] Database connection failed. Exiting.");
    process.exit(1);
  }

  if (FEATURES.CHAT) initSocket(io);
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

      stopJobs();
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
