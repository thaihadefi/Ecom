import { Router } from "express";
import * as fileManagerController from "../controllers/file-manager.controller";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const router = Router();

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
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, true);
  }
});

router.post(
  '/upload',
  upload.array("files"),
  fileManagerController.upload
);

router.patch(
  '/change-file-name',
  upload.none(),
  fileManagerController.changeFileNamePatch
);

router.patch(
  '/delete-file',
  upload.none(),
  fileManagerController.deleteFilePatch
);

router.patch(
  '/move-file',
  upload.none(),
  fileManagerController.moveFilePatch
);

router.post(
  '/folder/create',
  upload.none(),
  fileManagerController.createFolderPost
);

router.get(
  '/folder/list',
  fileManagerController.listFolder
);

router.get(
  '/file/list',
  fileManagerController.listFiles
);

router.patch(
  '/folder/move',
  upload.none(),
  fileManagerController.moveFolderPatch
);

router.patch(
  '/folder/rename',
  upload.none(),
  fileManagerController.renameFolderPatch
);

router.patch(
  '/folder/delete',
  upload.none(),
  fileManagerController.deleteFolderPatch
);

export default router;
