import express, { Request, Response, NextFunction } from 'express';
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

app.use("/", routes);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
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
  console.error("[FileManager] Unhandled error:", err instanceof Error ? err.message : err);
  res.status(500).json({ code: "error", message: "Internal server error!" });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Server is running on port ${port}`);
});
