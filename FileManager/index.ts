import express, { Request, Response, NextFunction } from 'express';
import dotenv from "dotenv";
dotenv.config();
import routes from "./routes/index.route";
import multer from 'multer';

const app = express();
const port = 4000;

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

app.use("/", routes);

// Error handler for Multer limits and general runtime errors
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ code: "error", message: "File size exceeds the 10MB limit!" });
      return;
    }
  }
  res.status(500).json({ code: "error", message: err.message || "Internal server error!" });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});