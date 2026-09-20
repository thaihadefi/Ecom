import multer from "multer";
import path from "path";
import { NextFunction, Request, Response } from "express";

const MB = 1024 * 1024;

export class UploadRejectedError extends Error {
  name = "UploadRejectedError";
  status = 400;
}

const IMAGE_TYPES: Record<string, string[]> = {
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".png": ["image/png"],
  ".gif": ["image/gif"],
  ".webp": ["image/webp"],
};

const CHAT_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp",
  ".mp4", ".webm", ".mov", ".mp3", ".wav", ".ogg",
  ".pdf", ".txt", ".csv", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".zip",
]);

const utf8Name = (name: string): string => Buffer.from(name, "latin1").toString("utf8");

const extensionOf = (name: string): string => path.extname(name).toLowerCase();

export const looksLikeImage = (buffer: Buffer): boolean => {
  if (buffer.length < 12) return false;
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng = buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isGif = buffer.subarray(0, 4).toString("latin1") === "GIF8";
  const isWebp = buffer.subarray(0, 4).toString("latin1") === "RIFF" && buffer.subarray(8, 12).toString("latin1") === "WEBP";
  return isJpeg || isPng || isGif || isWebp;
};

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * MB, files: 5, fields: 20, parts: 30 },
  fileFilter: (_req, file, cb) => {
    file.originalname = utf8Name(file.originalname);
    const allowedMimes = IMAGE_TYPES[extensionOf(file.originalname)];
    if (!allowedMimes || !allowedMimes.includes(file.mimetype)) {
      cb(new UploadRejectedError("Only JPG, PNG, GIF and WEBP images are allowed!"));
      return;
    }
    cb(null, true);
  },
});

export const chatUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * MB, files: 10, fields: 10, parts: 20 },
  fileFilter: (_req, file, cb) => {
    file.originalname = utf8Name(file.originalname);
    if (!CHAT_EXTENSIONS.has(extensionOf(file.originalname))) {
      cb(new UploadRejectedError("This file type is not allowed!"));
      return;
    }
    cb(null, true);
  },
});

export const adminFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * MB, files: 20, fields: 20, parts: 40 },
  fileFilter: (_req, file, cb) => {
    file.originalname = utf8Name(file.originalname);
    cb(null, true);
  },
});

export const textForm = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1, files: 0, fields: 100, fieldSize: 512 * 1024, parts: 120 },
});

export const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * MB, files: 1, fields: 5 },
});

export const requireRealImages = (req: Request, res: Response, next: NextFunction) => {
  const files: Express.Multer.File[] = req.file ? [req.file] : Array.isArray(req.files) ? req.files : [];
  if (files.some((file) => !looksLikeImage(file.buffer))) {
    res.status(400).json({ code: "error", message: "Only JPG, PNG, GIF and WEBP images are allowed!" });
    return;
  }
  next();
};
