import { Request, Response } from 'express';
import * as fileManagerService from '../../services/admin/file-manager.service';

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

    res.json({
      code: result.success ? "success" : "error",
      message: result.message
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Upload error!";
    console.error("[FileManager] upload error:", errorMessage);
    res.json({ code: "error", message: "Upload error!" });
  }
};

export const changeFileNamePatch = async (req: Request, res: Response) => {
  try {
    const { folder, oldFileName, newFileName } = req.body;

    if (!folder || !oldFileName || !newFileName) {
      res.json({ code: "error", message: "Missing required fields!" });
      return;
    }

    const result = await fileManagerService.renameFile(folder, oldFileName, newFileName);

    res.json({
      code: result.success ? "success" : "error",
      message: result.message
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Rename failed!";
    console.error("[FileManager] rename error:", errorMessage);
    res.json({ code: "error", message: "Rename failed!" });
  }
};

export const deleteFileDel = async (req: Request, res: Response) => {
  try {
    const folder = req.query.folder as string;
    const fileName = req.query.fileName as string;

    if (!folder || !fileName) {
      res.json({ code: "error", message: "Missing folder or fileName!" });
      return;
    }

    const result = await fileManagerService.deleteFile(folder, fileName);

    res.json({
      code: result.success ? "success" : "error",
      message: result.message
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Delete failed!";
    console.error("[FileManager] delete error:", errorMessage);
    res.json({ code: "error", message: "Delete failed!" });
  }
};

export const createFolderPost = async (req: Request, res: Response) => {
  try {
    const { folderName, folderPath } = req.body;

    if (!folderName) {
      res.json({ code: "error", message: "Please provide folder name!" });
      return;
    }

    const result = await fileManagerService.createFolder(folderName, folderPath);

    res.json({
      code: result.success ? "success" : "error",
      message: result.message
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Invalid data!";
    console.error("[FileManager] createFolder error:", errorMessage);
    res.json({ code: "error", message: "Invalid data!" });
  }
};

export const deleteFolderDel = async (req: Request, res: Response) => {
  try {
    const folderPath = req.query.folderPath as string;

    if (!folderPath) {
      res.json({ code: "error", message: "Please provide folder path!" });
      return;
    }

    const result = await fileManagerService.deleteFolder(folderPath);

    res.json({
      code: result.success ? "success" : "error",
      message: result.message
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Invalid data!";
    console.error("[FileManager] deleteFolder error:", errorMessage);
    res.json({ code: "error", message: "Invalid data!" });
  }
};

export const renameFolderPatch = async (req: Request, res: Response) => {
  try {
    const { folderPath, newFolderName } = req.body;

    if (!folderPath || !newFolderName) {
      res.json({ code: "error", message: "Missing folderPath or newFolderName!" });
      return;
    }

    const result = await fileManagerService.renameFolder(folderPath, newFolderName);

    res.json({
      code: result.success ? "success" : "error",
      message: result.message
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Rename failed!";
    console.error("[FileManager] renameFolder error:", errorMessage);
    res.json({ code: "error", message: "Rename failed!" });
  }
};

export const moveFolderPatch = async (req: Request, res: Response) => {
  try {
    const { folderPath, targetFolder } = req.body;

    if (!folderPath) {
      res.json({ code: "error", message: "Missing folderPath!" });
      return;
    }

    const result = await fileManagerService.moveFolder(folderPath, targetFolder);

    res.json({
      code: result.success ? "success" : "error",
      message: result.message
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Move failed!";
    console.error("[FileManager] moveFolder error:", errorMessage);
    res.json({ code: "error", message: "Move failed!" });
  }
};

export const moveFilePatch = async (req: Request, res: Response) => {
  try {
    const { folder, fileName, targetFolder } = req.body;

    if (!folder || !fileName) {
      res.json({ code: "error", message: "Missing folder or fileName!" });
      return;
    }

    const result = await fileManagerService.moveFile(folder, fileName, targetFolder);

    res.json({
      code: result.success ? "success" : "error",
      message: result.message
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    res.json({ code: "error", message: "Move failed: " + errorMessage });
  }
};

export const iframe = async (_req: Request, res: Response) => {
  res.render("admin/pages/file-manager-iframe", {
    pageTitle: "File Manager"
  });
};
