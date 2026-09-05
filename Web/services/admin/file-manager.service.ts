import axios from 'axios';
import FormData from "form-data";
import moment from "moment";
import Media from '../../models/media.model';
import { domainCDN } from '../../configs/variable.config';
import { escapeRegex } from '../../helpers/generate.helper';
import { formatFileSize } from '../../helpers/format.helper';
import { getPagination } from '../../helpers/pagination.helper';
import { propagateMediaRename, propagateMediaDelete } from '../../helpers/media-propagate.helper';

const FM_HEADERS = () => ({
  Authorization: `Bearer ${process.env.FILE_MANAGER_SECRET}`
});

type FmResponse = { code?: string; message?: string; [key: string]: unknown };

const fmSend = async (
  method: "post" | "patch",
  path: string,
  fields: Record<string, string>,
  files?: Express.Multer.File[],
): Promise<FmResponse> => {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value);
  }
  for (const file of files ?? []) {
    formData.append("files", file.buffer, { filename: file.originalname, contentType: file.mimetype });
  }

  const url = `${domainCDN}/file-manager/${path}`;
  const config = { headers: { ...formData.getHeaders(), ...FM_HEADERS() } };
  const response = method === "post"
    ? await axios.post(url, formData, config)
    : await axios.patch(url, formData, config);

  return response.data as FmResponse;
};

export const getFilesAndFolders = async (folderPath: string, rawKeyword?: unknown, rawPage?: unknown) => {
  const limit = 20;
  const page = Math.max(1, parseInt(rawPage as string) || 1);
  const normalizedFolder = "/media" + (folderPath ? `/${folderPath}` : "");
  let listFile: Array<Record<string, unknown>> = [];
  let pagination = { totalRecord: 0, totalPage: 1, currentPage: page };

  try {
    const find: Record<string, unknown> = { folder: normalizedFolder };

    if (rawKeyword) {
      const keyword = `${rawKeyword}`.trim();
      const keywordRegex = new RegExp(escapeRegex(keyword), "i");
      find.filename = keywordRegex;
    }

    const totalRecord = await Media.countDocuments(find);
    const pag = getPagination(rawPage, limit, totalRecord);

    const filesFromDb = await Media.find(find)
      .sort({ createdAt: -1 })
      .skip(pag.skip)
      .limit(limit);

    listFile = filesFromDb.map((item) => ({
      _id: item._id,
      filename: item.filename,
      folder: item.folder,
      size: item.size,
      mimetype: item.mimetype,
      createdAt: item.createdAt,
      createdAtFormat: item.createdAt
        ? moment(item.createdAt).format("HH:mm - DD/MM/YYYY")
        : "",
      sizeFormat: formatFileSize(item.size || 0)
    }));
    pagination = {
      totalRecord: pag.totalRecord,
      totalPage: pag.totalPage,
      currentPage: pag.currentPage
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("[Media DB] file list query error:", errorMessage);
  }

  let folderList: Array<Record<string, unknown>> = [];
  try {
    const folderRes = await axios.get(
      `${domainCDN}/file-manager/folder/list?folderPath=${folderPath}`,
      { headers: FM_HEADERS() }
    );
    if (folderRes.data.code === "success") {
      folderList = (folderRes.data.folderList || []).map((item: { createdAt: string | Date }) => ({
        ...item,
        createdAtFormat: moment(item.createdAt).format("HH:mm - DD/MM/YYYY")
      }));
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("[FileManager] folder/list error:", errorMessage);
  }

  return {
    listFile,
    folderList,
    pagination
  };
};

export const uploadFilesToCDN = async (files: Express.Multer.File[], folderPath?: string) => {
  const data = await fmSend("post", "upload", folderPath ? { folderPath } : {}, files);

  if (data.code !== "success") {
    return { success: false, message: "Upload error!" };
  }

  const saveLinks: { folder: string; filename: string; mimetype: string; size: number }[] =
    (data.saveLinks as { folder: string; filename: string; mimetype: string; size: number }[]) || [];
  if (saveLinks.length > 0) {
    await Media.insertMany(saveLinks);
  }

  return { success: true, message: "Uploaded successfully!" };
};

export const renameFile = async (folder: string, oldFileName: string, newFileName: string) => {
  const data = await fmSend("patch", "change-file-name", { folder, oldFileName, newFileName });

  if (data.code === "error") {
    return { success: false, message: data.message };
  }

  await Media.updateOne({ folder, filename: oldFileName }, { filename: newFileName });
  await propagateMediaRename(`${folder}/${oldFileName}`, `${folder}/${newFileName}`);

  return { success: true, message: "File renamed successfully!" };
};

export const deleteFile = async (folder: string, fileName: string) => {
  const data = await fmSend("patch", "delete-file", { folder, fileName });

  if (data.code === "error") {
    return { success: false, message: data.message };
  }

  await Media.deleteOne({ folder, filename: fileName });
  await propagateMediaDelete(`${folder}/${fileName}`);

  return { success: true, message: "File deleted successfully!" };
};

export const createFolder = async (folderName: string, folderPath?: string) => {
  const fields: Record<string, string> = { folderName };
  if (folderPath) fields.folderPath = folderPath;
  const data = await fmSend("post", "folder/create", fields);

  if (data.code === "error") {
    return { success: false, message: data.message };
  }

  return { success: true, message: "Folder created successfully!" };
};

export const deleteFolder = async (folderPath: string) => {
  const normalizedFolder = folderPath.startsWith("/") ? folderPath : `/${folderPath}`;

  const affectedMedia = await Media.find({
    folder: { $regex: `^${escapeRegex(normalizedFolder)}(/|$)` }
  }).select("folder filename");

  const data = await fmSend("patch", "folder/delete", { folderPath });

  if (data.code === "error") {
    return { success: false, message: data.message };
  }

  await Promise.all(
    affectedMedia.map((m) => propagateMediaDelete(`${m.folder}/${m.filename}`))
  );

  await Media.deleteMany({ folder: { $regex: `^${escapeRegex(normalizedFolder)}(/|$)` } });

  return { success: true, message: "Folder deleted successfully!" };
};

export const renameFolder = async (folderPath: string, newFolderName: string) => {
  const data = await fmSend("patch", "folder/rename", { folderPath, newFolderName });

  if (data.code === "error") {
    return { success: false, message: data.message };
  }

  const normalizedOld = folderPath.startsWith("/") ? folderPath : `/${folderPath}`;
  const parentDir = normalizedOld.substring(0, normalizedOld.lastIndexOf("/")) || "";
  const normalizedNew = `${parentDir}/${newFolderName}`;

  const affectedMedia = await Media.find({
    folder: { $regex: `^${escapeRegex(normalizedOld)}(/|$)` }
  }).select("_id folder filename");

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

  return { success: true, message: "Folder renamed successfully!" };
};

export const moveFolder = async (folderPath: string, targetFolder?: string) => {
  const normalizedSource = folderPath.startsWith("/") ? folderPath : `/${folderPath}`;
  const folderName = normalizedSource.split("/").filter(Boolean).pop() ?? "";
  const normalizedTarget = targetFolder
    ? (targetFolder.startsWith("/") ? targetFolder : `/${targetFolder}`)
    : "/media";
  const normalizedNew = `${normalizedTarget}/${folderName}`;

  if (normalizedNew === normalizedSource) {
    return { success: false, message: "Folder is already in that location!" };
  }

  const data = await fmSend("patch", "folder/move", {
    folderPath: normalizedSource,
    targetFolder: normalizedTarget,
  });

  if (data.code === "error") {
    return { success: false, message: data.message };
  }

  const affectedMedia = await Media.find({
    folder: { $regex: `^${escapeRegex(normalizedSource)}(/|$)` }
  }).select("_id folder filename");

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

  return { success: true, message: "Folder moved successfully!" };
};

export const moveFile = async (folder: string, fileName: string, targetFolder?: string) => {
  const targetFolderFull = "/media" + (targetFolder ? `/${targetFolder}` : "");

  if (folder === targetFolderFull) {
    return { success: false, message: "File is already in the target folder!" };
  }

  const data = await fmSend("patch", "move-file", { folder, fileName, targetFolder: targetFolderFull });

  if (data.code === "error") {
    return { success: false, message: data.message };
  }

  await Media.updateOne({ folder, filename: fileName }, { folder: targetFolderFull });
  await propagateMediaRename(`${folder}/${fileName}`, `${targetFolderFull}/${fileName}`);

  return { success: true, message: "File moved successfully!" };
};
