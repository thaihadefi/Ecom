import path from "path";
import fs from "fs";
import crypto from "crypto";
import mime from "mime-types";

const mediaRoot = path.resolve(__dirname, "../media");

export const isSafePath = (targetPath: string): boolean => {
  const resolvedPath = path.resolve(targetPath);
  return resolvedPath === mediaRoot || resolvedPath.startsWith(mediaRoot + path.sep);
};

export const getRelativePath = (inputPath: string): string => {
  if (!inputPath) return "";
  let clean = inputPath.replace(/\\/g, "/");
  clean = clean.replace(/^\/+/, "");
  if (clean.startsWith("media/")) {
    clean = clean.substring(6);
  } else if (clean === "media") {
    clean = "";
  }
  return clean.replace(/\/+$/, "");
};

export const isTempPath = (inputPath: string): boolean => {
  const clean = getRelativePath(inputPath);
  const segments = clean.split("/");
  return segments.includes("temp");
};

export const existsAsync = async (filePath: string): Promise<boolean> => {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
};

export interface UploadFileResult {
  folder: string;
  filename: string;
  mimetype: string;
  size: number;
}

export const uploadFiles = async (
  files: Express.Multer.File[],
  folderPathParam?: string
): Promise<{ success: boolean; status: number; message: string; saveLinks?: UploadFileResult[] }> => {
  if (!files || !Array.isArray(files) || files.length === 0) {
    return { success: false, status: 400, message: "No files uploaded!" };
  }

  const saveLinks: UploadFileResult[] = [];
  const relativeFolder = getRelativePath(folderPathParam || "");
  const mediaDir = path.resolve(mediaRoot, relativeFolder);

  try {
    if (!isSafePath(mediaDir) || isTempPath(relativeFolder)) {
      await Promise.all(files.map(file => fs.promises.unlink(file.path).catch(() => {})));
      return { success: false, status: 403, message: "Access denied!" };
    }

    if (!(await existsAsync(mediaDir))) {
      await fs.promises.mkdir(mediaDir, { recursive: true });
    }

    await Promise.all(
      files.map(async (file) => {
        try {
          const safeFilename = path.basename(file.originalname);
          const filename = `${crypto.randomUUID()}-${safeFilename}`;
          const savePath = path.resolve(mediaDir, filename);

          if (!isSafePath(savePath)) {
            await fs.promises.unlink(file.path).catch(() => {});
            return;
          }

          await fs.promises.rename(file.path, savePath);
          const resolvedMime = mime.lookup(savePath) || file.mimetype || "application/octet-stream";

          saveLinks.push({
            folder: "/media" + (relativeFolder ? `/${relativeFolder}` : ""),
            filename: filename,
            mimetype: resolvedMime,
            size: file.size
          });
        } catch (fileErr) {
          await fs.promises.unlink(file.path).catch(() => {});
          throw fileErr;
        }
      })
    );

    return {
      success: true,
      status: 200,
      message: "Upload successful!",
      saveLinks
    };
  } catch (error) {
    await Promise.all(files.map(file => fs.promises.unlink(file.path).catch(() => {})));
    return { success: false, status: 500, message: "Upload error!" };
  }
};

export const renameFile = async (
  folder: string,
  oldFileName: string,
  newFileName: string
): Promise<{ success: boolean; status: number; message: string }> => {
  if (!folder || !oldFileName || !newFileName) {
    return { success: false, status: 400, message: "Missing required information!" };
  }

  if (path.basename(oldFileName) !== oldFileName || path.basename(newFileName) !== newFileName) {
    return { success: false, status: 400, message: "Invalid file name!" };
  }

  const relativeFolder = getRelativePath(folder || "");
  const mediaDir = path.resolve(mediaRoot, relativeFolder);
  const oldPath = path.resolve(mediaDir, oldFileName);
  const newPath = path.resolve(mediaDir, newFileName);

  if (!isSafePath(oldPath) || !isSafePath(newPath) || isTempPath(relativeFolder)) {
    return { success: false, status: 403, message: "Access denied!" };
  }

  if (!(await existsAsync(oldPath))) {
    return { success: false, status: 404, message: "File does not exist!" };
  }

  if (await existsAsync(newPath)) {
    return { success: false, status: 409, message: "New file name already exists!" };
  }

  await fs.promises.rename(oldPath, newPath);
  return { success: true, status: 200, message: "Success!" };
};

export const deleteFile = async (
  folder: string,
  fileName: string
): Promise<{ success: boolean; status: number; message: string }> => {
  if (!folder || !fileName) {
    return { success: false, status: 400, message: "Missing required information!" };
  }

  if (path.basename(fileName) !== fileName) {
    return { success: false, status: 400, message: "Invalid file name!" };
  }

  const relativeFolder = getRelativePath(folder || "");
  const mediaDir = path.resolve(mediaRoot, relativeFolder);
  const filePath = path.resolve(mediaDir, fileName);

  if (!isSafePath(filePath) || isTempPath(relativeFolder)) {
    return { success: false, status: 403, message: "Access denied!" };
  }

  if (!(await existsAsync(filePath))) {
    return { success: false, status: 404, message: "File does not exist!" };
  }

  await fs.promises.unlink(filePath);
  return { success: true, status: 200, message: "Success!" };
};

export const createFolder = async (
  folderName: string,
  folderPath?: string
): Promise<{ success: boolean; status: number; message: string }> => {
  if (!folderName || typeof folderName !== "string" || !folderName.trim()) {
    return { success: false, status: 400, message: "Invalid directory name!" };
  }

  if (/[/\\:*?"<>|]|\.\./.test(folderName)) {
    return { success: false, status: 400, message: "Invalid folder name! Cannot contain: / \\ : * ? \" < > |" };
  }

  const relativeFolder = getRelativePath(folderPath || "");
  const targetPath = path.resolve(mediaRoot, relativeFolder, folderName);

  if (!isSafePath(targetPath) || isTempPath(relativeFolder) || folderName === "temp") {
    return { success: false, status: 403, message: "Access denied!" };
  }

  if (await existsAsync(targetPath)) {
    return { success: false, status: 409, message: "Folder already exists!" };
  }

  await fs.promises.mkdir(targetPath, { recursive: true });
  return { success: true, status: 200, message: "Success!" };
};

export const listFolders = async (
  folderPathParam?: string
): Promise<{ success: boolean; status: number; message: string; folderList?: { name: string; createdAt: Date }[] }> => {
  const relativeFolder = getRelativePath(folderPathParam || "");
  const mediaPath = path.resolve(mediaRoot, relativeFolder);

  if (!isSafePath(mediaPath) || isTempPath(relativeFolder)) {
    return { success: false, status: 403, message: "Access denied!" };
  }

  const items = await fs.promises.readdir(mediaPath);
  const folders: { name: string; createdAt: Date }[] = [];

  await Promise.all(
    items.map(async (item) => {
      if (item === "temp" && mediaPath === mediaRoot) {
        return;
      }

      const itemPath = path.join(mediaPath, item);
      try {
        const itemInfo = await fs.promises.stat(itemPath);
        if (itemInfo.isDirectory()) {
          folders.push({
            name: item,
            createdAt: itemInfo.birthtime
          });
        }
      } catch {
      }
    })
  );

  folders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return { success: true, status: 200, message: "Success!", folderList: folders };
};

export const moveFolder = async (
  folderPath: string,
  targetFolder?: string
): Promise<{ success: boolean; status: number; message: string }> => {
  if (!folderPath) {
    return { success: false, status: 400, message: "Missing folderPath!" };
  }

  const cleanSource = getRelativePath(folderPath || "");
  const sourceDir = path.resolve(mediaRoot, cleanSource);
  const folderName = path.basename(sourceDir);

  const cleanTarget = getRelativePath(targetFolder || "");
  const destDir = path.resolve(mediaRoot, cleanTarget);
  const newDir = path.resolve(destDir, folderName);

  if (!isSafePath(sourceDir) || !isSafePath(destDir) || !isSafePath(newDir) || isTempPath(folderPath) || isTempPath(targetFolder || "")) {
    return { success: false, status: 403, message: "Access denied!" };
  }

  if (!(await existsAsync(sourceDir))) {
    return { success: false, status: 404, message: "Folder does not exist!" };
  }

  if (sourceDir === mediaRoot) {
    return { success: false, status: 400, message: "Cannot move the root media folder!" };
  }

  if (newDir.startsWith(sourceDir + path.sep) || newDir === sourceDir) {
    return { success: false, status: 400, message: "Cannot move a folder into itself!" };
  }

  if (!(await existsAsync(destDir))) {
    return { success: false, status: 404, message: "Destination folder does not exist!" };
  }

  if (await existsAsync(newDir)) {
    return { success: false, status: 409, message: "A folder with that name already exists in the destination!" };
  }

  await fs.promises.rename(sourceDir, newDir);
  return { success: true, status: 200, message: "Folder moved successfully!" };
};

export const renameFolder = async (
  folderPath: string,
  newFolderName: string
): Promise<{ success: boolean; status: number; message: string }> => {
  if (!folderPath || !newFolderName) {
    return { success: false, status: 400, message: "Missing folderPath or newFolderName!" };
  }

  if (typeof newFolderName !== "string" || /[/\\:*?"<>|]|\.\./.test(newFolderName) || !newFolderName.trim()) {
    return { success: false, status: 400, message: "Invalid folder name! Cannot contain: / \\ : * ? \" < > |" };
  }

  const cleanPath = getRelativePath(folderPath || "");
  const oldDir = path.resolve(mediaRoot, cleanPath);
  const parentDir = path.dirname(oldDir);
  const newDir = path.resolve(parentDir, newFolderName);

  if (!isSafePath(oldDir) || !isSafePath(newDir) || isTempPath(folderPath) || newFolderName === "temp") {
    return { success: false, status: 403, message: "Access denied!" };
  }

  if (!(await existsAsync(oldDir))) {
    return { success: false, status: 404, message: "Folder does not exist!" };
  }

  if (await existsAsync(newDir)) {
    return { success: false, status: 409, message: "A folder with that name already exists!" };
  }

  if (oldDir === mediaRoot) {
    return { success: false, status: 400, message: "Renaming the root media folder is not allowed!" };
  }

  await fs.promises.rename(oldDir, newDir);
  return { success: true, status: 200, message: "Folder renamed successfully!" };
};

export const deleteFolder = async (
  folderPath: string
): Promise<{ success: boolean; status: number; message: string }> => {
  if (!folderPath) {
    return { success: false, status: 400, message: "Missing folder path!" };
  }

  const cleanFolderPath = getRelativePath(folderPath || "");
  const folderDir = path.resolve(mediaRoot, cleanFolderPath);

  if (!isSafePath(folderDir) || isTempPath(folderPath)) {
    return { success: false, status: 403, message: "Access denied!" };
  }

  if (folderDir === mediaRoot) {
    return { success: false, status: 400, message: "Deleting the root media directory is not allowed!" };
  }

  if (!(await existsAsync(folderDir))) {
    return { success: false, status: 404, message: "Folder does not exist!" };
  }

  await fs.promises.rm(folderDir, { recursive: true });
  return { success: true, status: 200, message: "Success!" };
};

export const listFiles = async (
  folderPathParam?: string,
  rawLimit?: unknown,
  rawPage?: unknown
): Promise<{
  success: boolean;
  status: number;
  message: string;
  files?: { folder: string; filename: string; mimetype: string; size: number; createdAt: Date }[];
  total?: number;
  totalPage?: number;
  currentPage?: number;
}> => {
  const relativeFolder = getRelativePath(folderPathParam && folderPathParam !== "undefined" ? folderPathParam : "");
  const mediaPath = path.resolve(mediaRoot, relativeFolder);

  if (!isSafePath(mediaPath) || isTempPath(relativeFolder)) {
    return { success: false, status: 403, message: "Access denied!" };
  }

  const items = await fs.promises.readdir(mediaPath);
  const files: { folder: string; filename: string; mimetype: string; size: number; createdAt: Date }[] = [];

  await Promise.all(
    items.map(async (item) => {
      const itemPath = path.join(mediaPath, item);
      try {
        const stat = await fs.promises.stat(itemPath);
        if (stat.isFile()) {
          const resolvedMime = mime.lookup(itemPath) || "application/octet-stream";
          files.push({
            folder: "/media" + (relativeFolder ? `/${relativeFolder}` : ""),
            filename: item,
            mimetype: resolvedMime,
            size: stat.size,
            createdAt: stat.birthtime
          });
        }
      } catch {
      }
    })
  );

  files.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const limit = parseInt(rawLimit as string) || 20;
  const page = Math.max(1, parseInt(rawPage as string) || 1);
  const total = files.length;
  const totalPage = Math.ceil(total / limit);
  const paged = files.slice((page - 1) * limit, page * limit);

  return {
    success: true,
    status: 200,
    message: "Success!",
    files: paged,
    total,
    totalPage,
    currentPage: page
  };
};

export const moveFile = async (
  folder: string,
  fileName: string,
  targetFolder?: string
): Promise<{ success: boolean; status: number; message: string }> => {
  if (!folder || !fileName) {
    return { success: false, status: 400, message: "Missing required information!" };
  }

  if (path.basename(fileName) !== fileName) {
    return { success: false, status: 400, message: "Invalid file name!" };
  }

  const cleanFolder = getRelativePath(folder || "");
  const cleanTargetFolder = getRelativePath(targetFolder || "");

  const oldPath = path.resolve(mediaRoot, cleanFolder, fileName);
  const newDir = path.resolve(mediaRoot, cleanTargetFolder);
  const newPath = path.resolve(newDir, fileName);

  if (!isSafePath(oldPath) || !isSafePath(newDir) || !isSafePath(newPath) || isTempPath(cleanFolder) || isTempPath(cleanTargetFolder)) {
    return { success: false, status: 403, message: "Access denied!" };
  }

  if (!(await existsAsync(oldPath))) {
    return { success: false, status: 404, message: "Source file does not exist!" };
  }

  if (!(await existsAsync(newDir))) {
    await fs.promises.mkdir(newDir, { recursive: true });
  }

  if (await existsAsync(newPath)) {
    return { success: false, status: 409, message: "File with this name already exists in target folder!" };
  }

  await fs.promises.rename(oldPath, newPath);
  return { success: true, status: 200, message: "File moved successfully!" };
};
