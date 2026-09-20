import path from "path";
import { Request, Response } from "express";
import * as mediaService from "../services/media.service";

const INLINE_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".ico", ".bmp",
  ".mp4", ".webm", ".mov", ".mp3", ".wav", ".ogg", ".pdf",
]);

export const getFile = async (req: Request, res: Response) => {
  const subPath = req.params.subPath;
  const type = req.query.type;

  const result = await mediaService.resolveMediaFilePath(subPath);

  if (result.status !== 200 || !result.filePath) {
    res.status(result.status).json({ code: "error", message: result.message });
    return;
  }

  res.set("X-Content-Type-Options", "nosniff");

  // Files the server refuses to send (for example dotfiles) are reported as not found instead of a server error.
  const onSendError = (error: Error & { status?: number }) => {
    if (!error || res.headersSent) return;
    const notFound = error.status === 404;
    res.status(notFound ? 404 : 500).json({ code: "error", message: notFound ? "File not found." : "Internal server error!" });
  };

  const extension = path.extname(result.filePath).toLowerCase();
  if (type === "download" || !INLINE_EXTENSIONS.has(extension)) {
    res.download(result.filePath, onSendError);
  } else {
    res.sendFile(result.filePath, onSendError);
  }
};
