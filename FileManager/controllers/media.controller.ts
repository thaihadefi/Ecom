import { Request, Response } from "express";
import * as mediaService from "../services/media.service";

export const getFile = async (req: Request, res: Response) => {
  const subPath = req.params.subPath;
  const type = req.query.type;

  const result = await mediaService.resolveMediaFilePath(subPath);

  if (result.status !== 200 || !result.filePath) {
    res.status(result.status).json({ code: "error", message: result.message });
    return;
  }

  if (type === "download") {
    res.download(result.filePath);
  } else {
    res.sendFile(result.filePath);
  }
};
