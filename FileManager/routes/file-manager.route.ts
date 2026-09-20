import { Router } from "express";
import * as fileManagerController from "../controllers/file-manager.controller";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { ALLOWED_EXTENSIONS } from "../config/allowed-extensions";

class UploadRejectedError extends Error {
  name = "UploadRejectedError";
}

const mediaRoot = path.resolve(process.cwd(), "media");
const tempDir = path.resolve(mediaRoot, "temp");

if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, tempDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const tempName = `${crypto.randomUUID()}${ext}`;
    cb(null, tempName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 20,
    fields: 20,
    parts: 40
  },
  fileFilter: (_req, file, cb) => {
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    if (!ALLOWED_EXTENSIONS.has(path.extname(file.originalname).toLowerCase())) {
      cb(new UploadRejectedError("This file type is not allowed!"));
      return;
    }
    cb(null, true);
  }
});

export const fileApi = Router();

fileApi.post(
  '/',
  upload.array("files"),
  fileManagerController.upload
);

fileApi.get(
  '/',
  fileManagerController.listFiles
);

fileApi.patch(
  '/name',
  upload.none(),
  fileManagerController.changeFileNamePatch
);

fileApi.patch(
  '/location',
  upload.none(),
  fileManagerController.moveFilePatch
);

fileApi.delete(
  '/',
  fileManagerController.deleteFileDel
);

export const folderApi = Router();

folderApi.post(
  '/',
  upload.none(),
  fileManagerController.createFolderPost
);

folderApi.get(
  '/',
  fileManagerController.listFolder
);

folderApi.patch(
  '/name',
  upload.none(),
  fileManagerController.renameFolderPatch
);

folderApi.patch(
  '/location',
  upload.none(),
  fileManagerController.moveFolderPatch
);

folderApi.delete(
  '/',
  fileManagerController.deleteFolderDel
);
