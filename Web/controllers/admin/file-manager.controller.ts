import { escapeRegex } from '../../helpers/generate.helper';
import { Request, Response } from 'express';
import FormData from "form-data";
import axios from 'axios';
import moment from "moment";
import { formatFileSize } from '../../helpers/format.helper';
import { domainCDN } from '../../configs/variable.config';
import { propagateMediaRename, propagateMediaDelete } from '../../helpers/media-propagate.helper';
import Media from '../../models/media.model';
import { getPagination } from '../../helpers/pagination.helper';

const FM_HEADERS = () => ({
  Authorization: `Bearer ${process.env.FILE_MANAGER_SECRET}`
});


export const fileManager = async (req: Request, res: Response) => {
  const folderPath = req.query.folderPath as string || "";

  // Pagination params
  const limit = 20;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);

  // Files list — query directly from MongoDB Media collection (which is indexed on folder and createdAt)
  const normalizedFolder = "/media" + (folderPath ? `/${folderPath}` : "");
  let listFile: any[] = [];
  let pagination = { totalRecord: 0, totalPage: 1, currentPage: page };
  try {
    const find: any = { folder: normalizedFolder };

    // Search by filename
    if(req.query.keyword) {
      const keyword = `${req.query.keyword}`.trim();
      const keywordRegex = new RegExp(escapeRegex(keyword), "i");
      find.filename = keywordRegex;
    }

    const totalRecord = await Media.countDocuments(find);
    const pag = getPagination(req.query.page, limit, totalRecord);

    const filesFromDb = await Media.find(find)
      .sort({ createdAt: -1 })
      .skip(pag.skip)
      .limit(limit)
      .lean();

    listFile = filesFromDb.map((item: any) => ({
      ...item,
      createdAtFormat: item.createdAt
        ? moment(item.createdAt).format("HH:mm - DD/MM/YYYY")
        : "",
      sizeFormat: formatFileSize(item.size)
    }));
    pagination = {
      totalRecord: pag.totalRecord,
      totalPage: pag.totalPage,
      currentPage: pag.currentPage
    };
  } catch (err: any) {
    console.error("[Media DB] file list query error:", err.message);
  }

  // Folders list
  let folderList: any[] = [];
  try {
    const folderRes = await axios.get(
      `${domainCDN}/file-manager/folder/list?folderPath=${folderPath}`,
      { headers: FM_HEADERS() }
    );
    if (folderRes.data.code === "success") {
      folderList = folderRes.data.folderList.map((item: any) => ({
        ...item,
        createdAtFormat: moment(item.createdAt).format("HH:mm - DD/MM/YYYY")
      }));
    }
  } catch (err: any) { console.error("[FileManager] folder/list error:", err.message); }

  res.render("admin/pages/file-manager", {
    pageTitle: "File Manager",
    listFile,
    folderList,
    pagination
  });
}

export const uploadPost = async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    const formData = new FormData();

    files?.forEach(file => {
      formData.append("files", file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype
      });
    });

    const folderPath = req.query.folderPath;
    if (folderPath) formData.append("folderPath", folderPath);

    const response = await axios.post(`${domainCDN}/file-manager/upload`, formData, {
      headers: { ...formData.getHeaders(), ...FM_HEADERS() }
    });

    if (response.data.code !== "success") {
      res.json({ code: "error", message: "Upload error!" });
      return;
    }

    // Save metadata to MongoDB
    const saveLinks: { folder: string; filename: string; mimetype: string; size: number }[] = response.data.saveLinks || [];
    if (saveLinks.length > 0) {
      await Media.insertMany(saveLinks);
    }

    res.json({ code: "success", message: "Uploaded successfully!" });
  } catch (err: any) {
    console.error("[FileManager] upload error:", err.message);
    res.json({ code: "error", message: "Upload error!" });
  }
}

export const changeFileNamePatch = async (req: Request, res: Response) => {
  try {
    const { folder, oldFileName, newFileName } = req.body;

    if (!folder || !oldFileName || !newFileName) {
      res.json({ code: "error", message: "Missing required fields!" });
      return;
    }

    const formData = new FormData();
    formData.append("folder", folder);
    formData.append("oldFileName", oldFileName);
    formData.append("newFileName", newFileName);

    const response = await axios.patch(`${domainCDN}/file-manager/change-file-name`, formData, {
      headers: { ...formData.getHeaders(), ...FM_HEADERS() }
    });

    if (response.data.code === "error") {
      res.json({ code: "error", message: response.data.message });
      return;
    }

    // Sync rename in MongoDB media collection
    await Media.updateOne({ folder, filename: oldFileName }, { filename: newFileName });

    // Propagate path change to all collections referencing this file
    await propagateMediaRename(`${folder}/${oldFileName}`, `${folder}/${newFileName}`);

    res.json({ code: "success", message: "File renamed successfully!" });
  } catch (err: any) {
    console.error("[FileManager] rename error:", err.message);
    res.json({ code: "error", message: "Rename failed!" });
  }
}

export const deleteFileDel = async (req: Request, res: Response) => {
  try {
    const folder = req.query.folder as string;
    const fileName = req.query.fileName as string;

    if (!folder || !fileName) {
      res.json({ code: "error", message: "Missing folder or fileName!" });
      return;
    }

    const formData = new FormData();
    formData.append("folder", folder);
    formData.append("fileName", fileName);

    const response = await axios.patch(`${domainCDN}/file-manager/delete-file`, formData, {
      headers: { ...formData.getHeaders(), ...FM_HEADERS() }
    });

    if (response.data.code === "error") {
      res.json({ code: "error", message: response.data.message });
      return;
    }

    // Remove from MongoDB
    await Media.deleteOne({ folder, filename: fileName });

    // Propagate deletion to other collections
    await propagateMediaDelete(`${folder}/${fileName}`);

    res.json({ code: "success", message: "File deleted successfully!" });
  } catch (err: any) {
    console.error("[FileManager] delete error:", err.message);
    res.json({ code: "error", message: "Delete failed!" });
  }
}

export const createFolderPost = async (req: Request, res: Response) => {
  try {
    const { folderName, folderPath } = req.body;

    if (!folderName) {
      res.json({ code: "error", message: "Please provide folder name!" });
      return;
    }

    const formData = new FormData();
    formData.append("folderName", folderName);
    if (folderPath) formData.append("folderPath", folderPath);

    const response = await axios.post(`${domainCDN}/file-manager/folder/create`, formData, {
      headers: { ...formData.getHeaders(), ...FM_HEADERS() }
    });

    res.json(
      response.data.code === "error"
        ? { code: "error", message: response.data.message }
        : { code: "success", message: "Folder created successfully!" }
    );
  } catch (err: any) {
    console.error("[FileManager] createFolder error:", err.message);
    res.json({ code: "error", message: "Invalid data!" });
  }
}

export const deleteFolderDel = async (req: Request, res: Response) => {
  try {
    const folderPath = req.query.folderPath as string;

    if (!folderPath) {
      res.json({ code: "error", message: "Please provide folder path!" });
      return;
    }

    // Normalise to "/media/..." prefix for DB queries
    const normalizedFolder = folderPath.startsWith("/") ? folderPath : `/${folderPath}`;

    // Find all Media docs inside this folder (and any subfolders) before deleting
    const affectedMedia = await Media.find({
      folder: { $regex: `^${escapeRegex(normalizedFolder)}(/|$)` }
    }).select("folder filename").lean();

    const formData = new FormData();
    formData.append("folderPath", folderPath);

    const response = await axios.patch(`${domainCDN}/file-manager/folder/delete`, formData, {
      headers: { ...formData.getHeaders(), ...FM_HEADERS() }
    });

    if (response.data.code === "error") {
      res.json({ code: "error", message: response.data.message });
      return;
    }

    // Cascade: remove DB refs for every file that was inside the folder
    await Promise.all(
      affectedMedia.map((m) => propagateMediaDelete(`${m.folder}/${m.filename}`))
    );

    // Remove all Media documents for deleted files
    await Media.deleteMany({ folder: { $regex: `^${escapeRegex(normalizedFolder)}(/|$)` } });

    res.json({ code: "success", message: "Folder deleted successfully!" });
  } catch (err: any) {
    console.error("[FileManager] deleteFolder error:", err.message);
    res.json({ code: "error", message: "Invalid data!" });
  }
}

export const renameFolderPatch = async (req: Request, res: Response) => {
  try {
    const { folderPath, newFolderName } = req.body;

    if (!folderPath || !newFolderName) {
      res.json({ code: "error", message: "Missing folderPath or newFolderName!" });
      return;
    }

    const formData = new FormData();
    formData.append("folderPath", folderPath);
    formData.append("newFolderName", newFolderName);

    const response = await axios.patch(`${domainCDN}/file-manager/folder/rename`, formData, {
      headers: { ...formData.getHeaders(), ...FM_HEADERS() }
    });

    if (response.data.code === "error") {
      res.json({ code: "error", message: response.data.message });
      return;
    }

    // Derive old and new full folder paths
    const normalizedOld = folderPath.startsWith("/") ? folderPath : `/${folderPath}`;
    const parentDir = normalizedOld.substring(0, normalizedOld.lastIndexOf("/")) || "";
    const normalizedNew = `${parentDir}/${newFolderName}`;

    // Find all Media docs inside the renamed folder (and subfolders)
    const affectedMedia = await Media.find({
      folder: { $regex: `^${escapeRegex(normalizedOld)}(/|$)` }
    }).select("_id folder filename").lean();

    // Update Media + propagate refs in one pass per file
    await Promise.all(
      affectedMedia.map((m) => {
        const folder = m.folder ?? "";
        const newFolder = folder.replace(normalizedOld, normalizedNew);
        const oldFilePath = `${folder}/${m.filename}`;
        const newFilePath = `${newFolder}/${m.filename}`;
        return Promise.all([
          Media.updateOne({ _id: m._id }, { folder: newFolder }),
          propagateMediaRename(oldFilePath, newFilePath)
        ]);
      })
    );

    res.json({ code: "success", message: "Folder renamed successfully!" });
  } catch (err: any) {
    console.error("[FileManager] renameFolder error:", err.message);
    res.json({ code: "error", message: "Rename failed!" });
  }
}

export const moveFolderPatch = async (req: Request, res: Response) => {
  try {
    const { folderPath, targetFolder } = req.body;

    if (!folderPath) {
      res.json({ code: "error", message: "Missing folderPath!" });
      return;
    }

    const normalizedSource = folderPath.startsWith("/") ? folderPath : `/${folderPath}`;
    const folderName = normalizedSource.split("/").filter(Boolean).pop() ?? "";
    const normalizedTarget = targetFolder
      ? (targetFolder.startsWith("/") ? targetFolder : `/${targetFolder}`)
      : "/media";
    const normalizedNew = `${normalizedTarget}/${folderName}`;

    if (normalizedNew === normalizedSource) {
      res.json({ code: "error", message: "Folder is already in that location!" });
      return;
    }

    const formData = new FormData();
    formData.append("folderPath", normalizedSource);
    formData.append("targetFolder", normalizedTarget);

    const response = await axios.patch(`${domainCDN}/file-manager/folder/move`, formData, {
      headers: { ...formData.getHeaders(), ...FM_HEADERS() }
    });

    if (response.data.code === "error") {
      res.json({ code: "error", message: response.data.message });
      return;
    }

    // Find all Media docs inside the moved folder (and subfolders)
    const affectedMedia = await Media.find({
      folder: { $regex: `^${escapeRegex(normalizedSource)}(/|$)` }
    }).select("_id folder filename").lean();

    // Update Media + propagate refs in one pass per file
    await Promise.all(
      affectedMedia.map((m) => {
        const folder = m.folder ?? "";
        const newFolder = folder.replace(normalizedSource, normalizedNew);
        const oldFilePath = `${folder}/${m.filename}`;
        const newFilePath = `${newFolder}/${m.filename}`;
        return Promise.all([
          Media.updateOne({ _id: m._id }, { folder: newFolder }),
          propagateMediaRename(oldFilePath, newFilePath)
        ]);
      })
    );

    res.json({ code: "success", message: "Folder moved successfully!" });
  } catch (err: any) {
    console.error("[FileManager] moveFolder error:", err.message);
    res.json({ code: "error", message: "Move failed!" });
  }
}

export const moveFilePatch = async (req: Request, res: Response) => {
  try {
    const { folder, fileName, targetFolder } = req.body;

    if (!folder || !fileName) {
      res.json({ code: "error", message: "Missing folder or fileName!" });
      return;
    }

    const targetFolderFull = "/media" + (targetFolder ? `/${targetFolder}` : "");

    if (folder === targetFolderFull) {
      res.json({ code: "error", message: "File is already in the target folder!" });
      return;
    }

    const formData = new FormData();
    formData.append("folder", folder);
    formData.append("fileName", fileName);
    formData.append("targetFolder", targetFolderFull);

    const response = await axios.patch(`${domainCDN}/file-manager/move-file`, formData, {
      headers: { ...formData.getHeaders(), ...FM_HEADERS() }
    });

    if (response.data.code === "error") {
      res.json({ code: "error", message: response.data.message });
      return;
    }

    // Sync move in MongoDB media collection
    await Media.updateOne({ folder, filename: fileName }, { folder: targetFolderFull });

    // Propagate path change to all collections referencing this file
    await propagateMediaRename(`${folder}/${fileName}`, `${targetFolderFull}/${fileName}`);

    res.json({ code: "success", message: "File moved successfully!" });
  } catch (error: any) {
    res.json({ code: "error", message: "Move failed: " + error.message });
  }
}

export const iframe = async (_req: Request, res: Response) => {
  res.render("admin/pages/file-manager-iframe", {
    pageTitle: "File Manager"
  });
}
