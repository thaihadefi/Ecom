import express, { Request, Response, NextFunction } from 'express';
import type { Socket } from 'node:net';
import dotenv from "dotenv";
dotenv.config();
import routes from "./routes/index.route";
import multer from 'multer';
import { cors } from "./middlewares/cors.middleware";
import { assertSecretStrength, trustProxy } from "./config/security.config";

assertSecretStrength();

const app = express();
app.set("trust proxy", trustProxy());
const port = 4000;

app.use(cors);

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// express.json()/urlencoded() leave req.body undefined when Content-Type matches neither;
// controllers read req.body directly, so default it.
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.body === undefined) req.body = {};
  next();
});

app.use("/", routes);

app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ code: "error", message: "File size exceeds the 10MB limit!" });
      return;
    }
  }
  if (err instanceof multer.MulterError) {
    res.status(400).json({ code: "error", message: err.message });
    return;
  }
  if (err instanceof Error && err.name === "UploadRejectedError") {
    res.status(400).json({ code: "error", message: err.message });
    return;
  }
  // A malformed multipart body makes busboy throw a plain Error multer doesn't classify.
  if (err instanceof Error && (req.headers["content-type"] || "").startsWith("multipart/form-data")) {
    res.status(400).json({ code: "error", message: "Malformed upload request!" });
    return;
  }
  console.error("[FileManager] Unhandled error:", err instanceof Error ? err.message : err);
  res.status(500).json({ code: "error", message: "Internal server error!" });
});

const server = app.listen(port, "0.0.0.0", () => {
  console.log(`Server is running on port ${port}`);
});

// A request Node's HTTP parser rejects (bad header bytes, malformed request line, ...) never
// reaches Express; without this handler the client gets a raw, bodyless 400 instead of JSON.
server.on('clientError', (err: NodeJS.ErrnoException, socket: Socket) => {
  if (err.code === 'ECONNRESET' || !socket.writable) return;
  const body = JSON.stringify({ code: 'error', message: 'Bad Request' });
  socket.end(
    `HTTP/1.1 400 Bad Request\r\n` +
    `Content-Type: application/json; charset=utf-8\r\n` +
    `Content-Length: ${Buffer.byteLength(body)}\r\n` +
    `Connection: close\r\n\r\n${body}`
  );
});
