import { Request, Response } from 'express';
import * as fileManagerService from '../../services/admin/file-manager.service';
import { caughtErrorStatus, resultStatus, sendCaughtError } from "../../helpers/http-response.helper";

export const fileManager = async (req: Request, res: Response) => {
  const folderPath = req.query.folderPath as string || "";
  const data = await fileManagerService.getFilesAndFolders(folderPath, req.query.keyword, req.query.page);

  res.render("admin/pages/file-manager", {
    pageTitle: "File Manager",
    ...data
  });
};

export const uploadPost = async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    const folderPath = req.query.folderPath as string | undefined;

    const result = await fileManagerService.uploadFilesToCDN(files, folderPath);

    res.status(resultStatus(result)).json({
      code: result.success ? "success" : "error",
      message: result.message
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Upload error!";
    console.error("[FileManager] upload error:", errorMessage);
    sendCaughtError(res, err, "Upload error!", "Upload error!");
  }
};

export const changeFileNamePatch = async (req: Request, res: Response) => {
  try {
    const { folder, oldFileName, newFileName } = req.body;

    if (!folder || !oldFileName || !newFileName) {
      res.status(400).json({ code: "error", message: "Missing required fields!" });
      return;
    }

    const result = await fileManagerService.renameFile(folder, oldFileName, newFileName);

    res.status(resultStatus(result)).json({
      code: result.success ? "success" : "error",
      message: result.message
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Rename failed!";
    console.error("[FileManager] rename error:", errorMessage);
    sendCaughtError(res, err, "Rename failed!", "Rename failed!");
  }
};

export const deleteFileDel = async (req: Request, res: Response) => {
  try {
    const folder = req.query.folder as string;
    const fileName = req.query.fileName as string;

    if (!folder || !fileName) {
      res.status(400).json({ code: "error", message: "Missing folder or fileName!" });
      return;
    }

    const result = await fileManagerService.deleteFile(folder, fileName);

    res.status(resultStatus(result)).json({
      code: result.success ? "success" : "error",
      message: result.message
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Delete failed!";
    console.error("[FileManager] delete error:", errorMessage);
    sendCaughtError(res, err, "Delete failed!", "Delete failed!");
  }
};

export const createFolderPost = async (req: Request, res: Response) => {
  try {
    const { folderName, folderPath } = req.body;

    if (!folderName) {
      res.status(400).json({ code: "error", message: "Please provide folder name!" });
      return;
    }

    const result = await fileManagerService.createFolder(folderName, folderPath);

    res.status(resultStatus(result)).json({
      code: result.success ? "success" : "error",
      message: result.message
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Invalid data!";
    console.error("[FileManager] createFolder error:", errorMessage);
    sendCaughtError(res, err, "Invalid data!");
  }
};

export const deleteFolderDel = async (req: Request, res: Response) => {
  try {
    const folderPath = req.query.folderPath as string;

    if (!folderPath) {
      res.status(400).json({ code: "error", message: "Please provide folder path!" });
      return;
    }

    const result = await fileManagerService.deleteFolder(folderPath);

    res.status(resultStatus(result)).json({
      code: result.success ? "success" : "error",
      message: result.message
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Invalid data!";
    console.error("[FileManager] deleteFolder error:", errorMessage);
    sendCaughtError(res, err, "Invalid data!");
  }
};

export const renameFolderPatch = async (req: Request, res: Response) => {
  try {
    const { folderPath, newFolderName } = req.body;

    if (!folderPath || !newFolderName) {
      res.status(400).json({ code: "error", message: "Missing folderPath or newFolderName!" });
      return;
    }

    const result = await fileManagerService.renameFolder(folderPath, newFolderName);

    res.status(resultStatus(result)).json({
      code: result.success ? "success" : "error",
      message: result.message
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Rename failed!";
    console.error("[FileManager] renameFolder error:", errorMessage);
    sendCaughtError(res, err, "Rename failed!", "Rename failed!");
  }
};

export const moveFolderPatch = async (req: Request, res: Response) => {
  try {
    const { folderPath, targetFolder } = req.body;

    if (!folderPath) {
      res.status(400).json({ code: "error", message: "Missing folderPath!" });
      return;
    }

    const result = await fileManagerService.moveFolder(folderPath, targetFolder);

    res.status(resultStatus(result)).json({
      code: result.success ? "success" : "error",
      message: result.message
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Move failed!";
    console.error("[FileManager] moveFolder error:", errorMessage);
    sendCaughtError(res, err, "Move failed!", "Move failed!");
  }
};

export const moveFilePatch = async (req: Request, res: Response) => {
  try {
    const { folder, fileName, targetFolder } = req.body;

    if (!folder || !fileName) {
      res.status(400).json({ code: "error", message: "Missing folder or fileName!" });
      return;
    }

    const result = await fileManagerService.moveFile(folder, fileName, targetFolder);

    res.status(resultStatus(result)).json({
      code: result.success ? "success" : "error",
      message: result.message
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    res.status(caughtErrorStatus(error)).json({ code: "error", message: "Move failed: " + errorMessage });
  }
};

export const iframe = async (_req: Request, res: Response) => {
  res.render("admin/pages/file-manager-iframe", {
    pageTitle: "File Manager"
  });
};
