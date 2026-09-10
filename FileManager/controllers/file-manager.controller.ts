import { Request, Response } from "express";
import * as fileManagerService from "../services/file-manager.service";

export const upload = async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[];
  const result = await fileManagerService.uploadFiles(files, req.body.folderPath);

  res.status(result.status).json({
    code: result.success ? "success" : "error",
    message: result.message,
    saveLinks: result.saveLinks
  });
};

export const changeFileNamePatch = async (req: Request, res: Response) => {
  const { folder, oldFileName, newFileName } = req.body;
  const result = await fileManagerService.renameFile(folder, oldFileName, newFileName);

  res.status(result.status).json({
    code: result.success ? "success" : "error",
    message: result.message
  });
};

export const deleteFilePatch = async (req: Request, res: Response) => {
  const { folder, fileName } = req.body;
  const result = await fileManagerService.deleteFile(folder, fileName);

  res.status(result.status).json({
    code: result.success ? "success" : "error",
    message: result.message
  });
};

export const createFolderPost = async (req: Request, res: Response) => {
  const { folderName, folderPath } = req.body;
  const result = await fileManagerService.createFolder(folderName, folderPath);

  res.status(result.status).json({
    code: result.success ? "success" : "error",
    message: result.message
  });
};

export const listFolder = async (req: Request, res: Response) => {
  const result = await fileManagerService.listFolders(req.query.folderPath as string);

  res.status(result.status).json({
    code: result.success ? "success" : "error",
    message: result.message,
    folderList: result.folderList
  });
};

export const moveFolderPatch = async (req: Request, res: Response) => {
  const { folderPath, targetFolder } = req.body;
  const result = await fileManagerService.moveFolder(folderPath, targetFolder);

  res.status(result.status).json({
    code: result.success ? "success" : "error",
    message: result.message
  });
};

export const renameFolderPatch = async (req: Request, res: Response) => {
  const { folderPath, newFolderName } = req.body;
  const result = await fileManagerService.renameFolder(folderPath, newFolderName);

  res.status(result.status).json({
    code: result.success ? "success" : "error",
    message: result.message
  });
};

export const deleteFolderPatch = async (req: Request, res: Response) => {
  const { folderPath } = req.body;
  const result = await fileManagerService.deleteFolder(folderPath);

  res.status(result.status).json({
    code: result.success ? "success" : "error",
    message: result.message
  });
};

export const listFiles = async (req: Request, res: Response) => {
  const result = await fileManagerService.listFiles(
    req.query.folderPath as string,
    req.query.limit,
    req.query.page
  );

  res.status(result.status).json({
    code: result.success ? "success" : "error",
    message: result.message,
    files: result.files,
    total: result.total,
    totalPage: result.totalPage,
    currentPage: result.currentPage
  });
};

export const moveFilePatch = async (req: Request, res: Response) => {
  const { folder, fileName, targetFolder } = req.body;
  const result = await fileManagerService.moveFile(folder, fileName, targetFolder);

  res.status(result.status).json({
    code: result.success ? "success" : "error",
    message: result.message
  });
};
