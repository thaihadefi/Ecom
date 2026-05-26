import { Request, Response } from "express";
import path from "path";
import fs from "fs";

export const getFile = async (req: Request, res: Response) => {
  const subPath = req.params.subPath;
  const type = req.query.type;

  const mediaRoot = path.resolve(__dirname, "../media");

  if (!subPath || !Array.isArray(subPath)) {
    res.status(400).json({ code: "error", message: "Invalid path." });
    return;
  }

  // Filter out any empty segments or segments containing only dots/path separators to prevent directory traversal
  const cleanSegments = subPath.filter(
    (seg) => typeof seg === "string" && seg !== "" && seg !== ".." && seg !== "."
  );

  // Block direct HTTP access to the temp directory
  if (cleanSegments.includes("temp")) {
    res.status(403).json({ code: "error", message: "Access denied." });
    return;
  }

  const mediaPath = path.resolve(mediaRoot, ...cleanSegments);

  // Block path traversal (e.g. ../../.env)
  if (!mediaPath.startsWith(mediaRoot + path.sep) && mediaPath !== mediaRoot) {
    res.status(403).json({ code: "error", message: "Access denied." });
    return;
  }

  try {
    const stat = await fs.promises.stat(mediaPath);
    if (!stat.isFile()) {
      res.status(404).json({ code: "error", message: "File not found." });
      return;
    }
  } catch (err) {
    res.status(404).json({ code: "error", message: "File not found." });
    return;
  }

  if(type == "download") {
    res.download(mediaPath);
  } else {
    res.sendFile(mediaPath);
  }
}