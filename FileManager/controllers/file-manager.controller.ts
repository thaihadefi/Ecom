import { Request, Response } from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import mime from "mime-types";

const mediaRoot = path.resolve(__dirname, "../media");

const isSafePath = (targetPath: string): boolean => {
  const resolvedPath = path.resolve(targetPath);
  return resolvedPath === mediaRoot || resolvedPath.startsWith(mediaRoot + path.sep);
};

const getRelativePath = (inputPath: string): string => {
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

const isTempPath = (inputPath: string): boolean => {
  const clean = getRelativePath(inputPath);
  const segments = clean.split("/");
  return segments.includes("temp");
};

const existsAsync = async (filePath: string): Promise<boolean> => {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
};

export const upload = async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[];
  if (!files || !Array.isArray(files)) {
    res.status(400).json({ code: "error", message: "No files uploaded!" });
    return;
  }

  const saveLinks: {
    folder: string,
    filename: string,
    mimetype: string,
    size: number
  }[] = [];

  const folderPath = req.body.folderPath;
  const relativeFolder = getRelativePath(folderPath || "");
  const mediaDir = path.resolve(mediaRoot, relativeFolder);

  try {
    if (!isSafePath(mediaDir) || isTempPath(relativeFolder)) {
      // Clean up uploaded temp files
      await Promise.all(files.map(file => fs.promises.unlink(file.path).catch(() => {})));
      res.status(403).json({ code: "error", message: "Access denied!" });
      return;
    }

    // Check and create directory if it does not exist
    if (!(await existsAsync(mediaDir))) {
      await fs.promises.mkdir(mediaDir, { recursive: true });
    }
    
    await Promise.all(
      files.map(async (file) => {
        try {
          const safeFilename = path.basename(file.originalname);
          // Guarantee uniqueness using crypto.randomUUID
          const filename = `${crypto.randomUUID()}-${safeFilename}`;
          const savePath = path.resolve(mediaDir, filename);

          // Verify that the final save path is secure
          if (!isSafePath(savePath)) {
            await fs.promises.unlink(file.path).catch(() => {});
            return;
          }

          // Move file from temp to final folder
          await fs.promises.rename(file.path, savePath);

          // Dynamically lookup mime type using mime-types package
          const resolvedMime = mime.lookup(savePath) || file.mimetype || "application/octet-stream";

          saveLinks.push({
            folder: "/media" + (relativeFolder ? `/${relativeFolder}` : ""),
            filename: filename,
            mimetype: resolvedMime,
            size: file.size
          });
        } catch (fileErr) {
          // Cleanup temp file in case of individual file processing error
          await fs.promises.unlink(file.path).catch(() => {});
          throw fileErr;
        }
      })
    );

    res.status(200).json({
      code: "success",
      message: "Upload successful!",
      saveLinks: saveLinks
    });
  } catch (error) {
    // Cleanup any remaining temp files just in case
    await Promise.all(files.map(file => fs.promises.unlink(file.path).catch(() => {})));
    res.status(500).json({
      code: "error",
      message: "Upload error!"
    });
  }
}

export const changeFileNamePatch = async (req: Request, res: Response) => {
  try {
    const { folder, oldFileName, newFileName } = req.body;

    if(!folder || !oldFileName || !newFileName) {
      res.status(400).json({
        code: "error",
        message: "Missing required information!"
      });
      return;
    }

    if (path.basename(oldFileName) !== oldFileName || path.basename(newFileName) !== newFileName) {
      res.status(400).json({
        code: "error",
        message: "Invalid file name!"
      });
      return;
    }

    // Create path to file
    const relativeFolder = getRelativePath(folder || "");
    const mediaDir = path.resolve(mediaRoot, relativeFolder);
    const oldPath = path.resolve(mediaDir, oldFileName);
    const newPath = path.resolve(mediaDir, newFileName);

    if (!isSafePath(oldPath) || !isSafePath(newPath) || isTempPath(relativeFolder)) {
      res.status(403).json({
        code: "error",
        message: "Access denied!"
      });
      return;
    }

    if(!(await existsAsync(oldPath))) {
      res.status(404).json({
        code: "error",
        message: "File does not exist!"
      });
      return;
    }

    if(await existsAsync(newPath)) {
      res.status(409).json({
        code: "error",
        message: "New file name already exists!"
      });
      return;
    }

    // Rename file
    await fs.promises.rename(oldPath, newPath);

    res.status(200).json({
      code: "success",
      message: "Success!"
    });
  } catch (error) {
    res.status(500).json({
      code: "error",
      message: "Server error when renaming file!"
    });
  }
}

export const deleteFilePatch = async (req: Request, res: Response) => {
  try {
    const { folder, fileName } = req.body;

    if(!folder || !fileName) {
      res.status(400).json({
        code: "error",
        message: "Missing required information!"
      });
      return;
    }

    if (path.basename(fileName) !== fileName) {
      res.status(400).json({
        code: "error",
        message: "Invalid file name!"
      });
      return;
    }

    // Create path to file
    const relativeFolder = getRelativePath(folder || "");
    const mediaDir = path.resolve(mediaRoot, relativeFolder);
    const filePath = path.resolve(mediaDir, fileName);

    if (!isSafePath(filePath) || isTempPath(relativeFolder)) {
      res.status(403).json({
        code: "error",
        message: "Access denied!"
      });
      return;
    }

    if(!(await existsAsync(filePath))) {
      res.status(404).json({
        code: "error",
        message: "File does not exist!"
      });
      return;
    }

    // Delete file
    await fs.promises.unlink(filePath);

    res.status(200).json({
      code: "success",
      message: "Success!"
    });
  } catch (error) {
    res.status(500).json({
      code: "error",
      message: "Server error when deleting file!"
    });
  }
}

export const createFolderPost = async (req: Request, res: Response) => {
  try {
    const { folderName, folderPath } = req.body;

    if (!folderName || typeof folderName !== "string" || !folderName.trim()) {
      res.status(400).json({ code: "error", message: "Invalid directory name!" });
      return;
    }

    if (/[/\\:*?"<>|]|\.\./.test(folderName)) {
      res.status(400).json({ code: "error", message: "Invalid folder name! Cannot contain: / \\ : * ? \" < > |" });
      return;
    }

    const relativeFolder = getRelativePath(folderPath || "");
    const targetPath = path.resolve(mediaRoot, relativeFolder, folderName);

    if (!isSafePath(targetPath) || isTempPath(relativeFolder) || folderName === "temp") {
      res.status(403).json({
        code: "error",
        message: "Access denied!"
      });
      return;
    }

    if(await existsAsync(targetPath)) {
      res.status(409).json({
        code: "error",
        message: "Folder already exists!"
      });
      return;
    }

    // Create folder
    await fs.promises.mkdir(targetPath, { recursive: true });

    res.status(200).json({
      code: "success",
      message: "Success!"
    });
  } catch (error) {
    res.status(500).json({
      code: "error",
      message: "Server error when creating folder!"
    });
  }
}

export const listFolder = async (req: Request, res: Response) => {
  try {
    const relativeFolder = getRelativePath((req.query.folderPath as string) || "");
    const mediaPath = path.resolve(mediaRoot, relativeFolder);

    if (!isSafePath(mediaPath) || isTempPath(relativeFolder)) {
      res.status(403).json({ code: "error", message: "Access denied!" });
      return;
    }

    // Read list of files/directories in media
    const items = await fs.promises.readdir(mediaPath);
    
    const folders: {
      name: string,
      createdAt: Date
    }[] = [];

    await Promise.all(
      items.map(async (item) => {
        // Hide the temporary uploads folder
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
          // Ignore items that can't be read
        }
      })
    );

    // Sort descending by creation date
    folders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    res.status(200).json({
      code: "success",
      message: "Success!",
      folderList: folders
    });
  } catch (error) {
    res.status(500).json({
      code: "error",
      message: "Failed to get folder list!"
    });
  }
}

export const moveFolderPatch = async (req: Request, res: Response) => {
  try {
    const { folderPath, targetFolder } = req.body;

    if (!folderPath) {
      res.status(400).json({ code: "error", message: "Missing folderPath!" });
      return;
    }

    const cleanSource = getRelativePath(folderPath || "");
    const sourceDir = path.resolve(mediaRoot, cleanSource);
    const folderName = path.basename(sourceDir);

    const cleanTarget = getRelativePath(targetFolder || "");
    const destDir = path.resolve(mediaRoot, cleanTarget);
    const newDir = path.resolve(destDir, folderName);

    if (!isSafePath(sourceDir) || !isSafePath(destDir) || !isSafePath(newDir) || isTempPath(folderPath) || isTempPath(targetFolder)) {
      res.status(403).json({ code: "error", message: "Access denied!" });
      return;
    }

    if (!(await existsAsync(sourceDir))) {
      res.status(404).json({ code: "error", message: "Folder does not exist!" });
      return;
    }

    if (sourceDir === mediaRoot) {
      res.status(400).json({ code: "error", message: "Cannot move the root media folder!" });
      return;
    }

    // Prevent moving a folder into itself or its own descendant
    if (newDir.startsWith(sourceDir + path.sep) || newDir === sourceDir) {
      res.status(400).json({ code: "error", message: "Cannot move a folder into itself!" });
      return;
    }

    if (!(await existsAsync(destDir))) {
      res.status(404).json({ code: "error", message: "Destination folder does not exist!" });
      return;
    }

    if (await existsAsync(newDir)) {
      res.status(409).json({ code: "error", message: "A folder with that name already exists in the destination!" });
      return;
    }

    await fs.promises.rename(sourceDir, newDir);

    res.status(200).json({ code: "success", message: "Folder moved successfully!" });
  } catch (error) {
    res.status(500).json({ code: "error", message: "Server error when moving folder!" });
  }
}

export const renameFolderPatch = async (req: Request, res: Response) => {
  try {
    const { folderPath, newFolderName } = req.body;

    if (!folderPath || !newFolderName) {
      res.status(400).json({ code: "error", message: "Missing folderPath or newFolderName!" });
      return;
    }

    if (typeof newFolderName !== "string" || /[/\\:*?"<>|]|\.\./.test(newFolderName) || !newFolderName.trim()) {
      res.status(400).json({ code: "error", message: "Invalid folder name! Cannot contain: / \\ : * ? \" < > |" });
      return;
    }

    const cleanPath = getRelativePath(folderPath || "");
    const oldDir = path.resolve(mediaRoot, cleanPath);
    const parentDir = path.dirname(oldDir);
    const newDir = path.resolve(parentDir, newFolderName);

    if (!isSafePath(oldDir) || !isSafePath(newDir) || isTempPath(folderPath) || newFolderName === "temp") {
      res.status(403).json({ code: "error", message: "Access denied!" });
      return;
    }

    if (!(await existsAsync(oldDir))) {
      res.status(404).json({ code: "error", message: "Folder does not exist!" });
      return;
    }

    if (await existsAsync(newDir)) {
      res.status(409).json({ code: "error", message: "A folder with that name already exists!" });
      return;
    }

    // Prevent renaming the root media directory
    if (oldDir === mediaRoot) {
      res.status(400).json({ code: "error", message: "Renaming the root media folder is not allowed!" });
      return;
    }

    await fs.promises.rename(oldDir, newDir);

    res.status(200).json({ code: "success", message: "Folder renamed successfully!" });
  } catch (error) {
    res.status(500).json({ code: "error", message: "Server error when renaming folder!" });
  }
}

export const deleteFolderPatch = async (req: Request, res: Response) => {
  try {
    const { folderPath } = req.body;

    if(!folderPath) {
      res.status(400).json({
        code: "error",
        message: "Missing folder path!"
      });
      return;
    }

    const cleanFolderPath = getRelativePath(folderPath || "");
    const folderDir = path.resolve(mediaRoot, cleanFolderPath);

    if (!isSafePath(folderDir) || isTempPath(folderPath)) {
      res.status(403).json({
        code: "error",
        message: "Access denied!"
      });
      return;
    }

    if (folderDir === mediaRoot) {
      res.status(400).json({
        code: "error",
        message: "Deleting the root media directory is not allowed!"
      });
      return;
    }

    if(!(await existsAsync(folderDir))) {
      res.status(404).json({
        code: "error",
        message: "Folder does not exist!"
      });
      return;
    }

    // Delete folder
    await fs.promises.rm(folderDir, {
      recursive: true
    });

    res.status(200).json({
      code: "success",
      message: "Success!"
    });
  } catch (error) {
    res.status(500).json({
      code: "error",
      message: "Server error when deleting folder!"
    });
  }
}

export const listFiles = async (req: Request, res: Response) => {
  try {
    const folderParam = req.query.folderPath as string;
    const relativeFolder = getRelativePath(folderParam && folderParam !== "undefined" ? folderParam : "");
    const mediaPath = path.resolve(mediaRoot, relativeFolder);

    if (!isSafePath(mediaPath) || isTempPath(relativeFolder)) {
      res.status(403).json({ code: "error", message: "Access denied!" });
      return;
    }

    const items = await fs.promises.readdir(mediaPath);

    const files: { folder: string; filename: string; mimetype: string; size: number; createdAt: Date }[] = [];

    await Promise.all(
      items.map(async (item) => {
        const itemPath = path.join(mediaPath, item);
        try {
          const stat = await fs.promises.stat(itemPath);
          if (stat.isFile()) {
            // Dynamically look up mimetype using mime-types package
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
          // Ignore items that can't be stat
        }
      })
    );

    // Sort newest first
    files.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Pagination
    const limit = parseInt(req.query.limit as string) || 20;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const total = files.length;
    const totalPage = Math.ceil(total / limit);
    const paged = files.slice((page - 1) * limit, page * limit);

    res.status(200).json({ code: "success", files: paged, total, totalPage, currentPage: page });
  } catch (error) {
    res.status(500).json({ code: "error", message: "Failed to list files!" });
  }
}

export const moveFilePatch = async (req: Request, res: Response) => {
  try {
    const { folder, fileName, targetFolder } = req.body;

    if(!folder || !fileName) {
      res.status(400).json({
        code: "error",
        message: "Missing required information!"
      });
      return;
    }

    if (path.basename(fileName) !== fileName) {
      res.status(400).json({
        code: "error",
        message: "Invalid file name!"
      });
      return;
    }

    const cleanFolder = getRelativePath(folder || "");
    const cleanTargetFolder = getRelativePath(targetFolder || "");

    const oldPath = path.resolve(mediaRoot, cleanFolder, fileName);
    const newDir = path.resolve(mediaRoot, cleanTargetFolder);
    const newPath = path.resolve(newDir, fileName);

    if (!isSafePath(oldPath) || !isSafePath(newDir) || !isSafePath(newPath) || isTempPath(cleanFolder) || isTempPath(cleanTargetFolder)) {
      res.status(403).json({
        code: "error",
        message: "Access denied!"
      });
      return;
    }

    if(!(await existsAsync(oldPath))) {
      res.status(404).json({
        code: "error",
        message: "Source file does not exist!"
      });
      return;
    }

    // Check and create destination directory if it does not exist
    if (!(await existsAsync(newDir))) {
      await fs.promises.mkdir(newDir, { recursive: true });
    }

    if(await existsAsync(newPath)) {
      res.status(409).json({
        code: "error",
        message: "File with this name already exists in target folder!"
      });
      return;
    }

    // Move file
    await fs.promises.rename(oldPath, newPath);

    res.status(200).json({
      code: "success",
      message: "File moved successfully!"
    });
  } catch (error: any) {
    res.status(500).json({
      code: "error",
      message: "Server error when moving file: " + error.message
    });
  }
}