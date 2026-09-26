import { formatDateTime } from "../../helpers/format.helper";
import axios from 'axios';
import FormData from "form-data";
import Media from '../../models/media.model';
import { domainCDN } from '../../configs/variable.config';
import { escapeRegex } from '../../helpers/generate.helper';
import { formatFileSize } from '../../helpers/format.helper';
import { getPagination } from '../../helpers/pagination.helper';
import { propagateMediaRename, propagateMediaDelete } from '../../helpers/media-propagate.helper';
import { upstreamStatus } from "../../helpers/http-response.helper";

const FM_HEADERS = () => ({
  Authorization: `Bearer ${process.env.FILE_MANAGER_SECRET}`
});

type FmResponse = { code?: string; message?: string; httpStatus: number; [key: string]: unknown };

const fmSend = async (
  method: "post" | "patch" | "delete",
  path: string,
  fields: Record<string, string>,
  files?: Express.Multer.File[],
): Promise<FmResponse> => {
  if (method === "delete") {
    const response = await axios.delete(`${domainCDN}/${path}`, { params: fields, headers: FM_HEADERS(), validateStatus: () => true });
    return { ...response.data, httpStatus: response.status } as FmResponse;
  }

  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value);
  }
  for (const file of files ?? []) {
    formData.append("files", file.buffer, { filename: file.originalname, contentType: file.mimetype });
  }

  const url = `${domainCDN}/${path}`;
  const config = { headers: { ...formData.getHeaders(), ...FM_HEADERS() }, validateStatus: () => true };
  const response = await axios.request({ method, url, data: formData, ...config });

  return { ...response.data, httpStatus: response.status } as FmResponse;
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
        ? formatDateTime(item.createdAt)
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
      `${domainCDN}/folders`,
      { headers: FM_HEADERS(), params: { folderPath } }
    );
    if (folderRes.data.code === "success") {
      folderList = (folderRes.data.folderList || []).map((item: { createdAt: string | Date }) => ({
        ...item,
        createdAtFormat: formatDateTime(item.createdAt)
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
  const data = await fmSend("post", "files", folderPath ? { folderPath } : {}, files);

  if (data.code !== "success") {
    return { success: false, status: upstreamStatus(data.httpStatus), message: data.message || "Upload error!" };
  }

  const saveLinks: { folder: string; filename: string; mimetype: string; size: number }[] =
    (data.saveLinks as { folder: string; filename: string; mimetype: string; size: number }[]) || [];
  if (saveLinks.length > 0) {
    await Media.insertMany(saveLinks);
  }

  return { success: true, message: "Uploaded successfully!" };
};

export const renameFile = async (folder: string, oldFileName: string, newFileName: string) => {
  const data = await fmSend("patch", "files/name", { folder, oldFileName, newFileName });

  if (data.code === "error") {
    return { success: false, status: upstreamStatus(data.httpStatus), message: data.message };
  }

  await Media.updateOne({ folder, filename: oldFileName }, { filename: newFileName });
  await propagateMediaRename(`${folder}/${oldFileName}`, `${folder}/${newFileName}`);

  return { success: true, message: "File renamed successfully!" };
};

export const deleteFile = async (folder: string, fileName: string) => {
  const data = await fmSend("delete", "files", { folder, fileName });

  if (data.code === "error") {
    return { success: false, status: upstreamStatus(data.httpStatus), message: data.message };
  }

  await Media.deleteOne({ folder, filename: fileName });
  await propagateMediaDelete(`${folder}/${fileName}`);

  return { success: true, message: "File deleted successfully!" };
};

export const createFolder = async (folderName: string, folderPath?: string) => {
  const fields: Record<string, string> = { folderName };
  if (folderPath) fields.folderPath = folderPath;
  const data = await fmSend("post", "folders", fields);

  if (data.code === "error") {
    return { success: false, status: upstreamStatus(data.httpStatus), message: data.message };
  }

  return { success: true, message: "Folder created successfully!" };
};

export const deleteFolder = async (folderPath: string) => {
  const normalizedFolder = folderPath.startsWith("/") ? folderPath : `/${folderPath}`;

  const affectedMedia = await Media.find({
    folder: { $regex: `^${escapeRegex(normalizedFolder)}(/|$)` }
  }).select("folder filename");

  const data = await fmSend("delete", "folders", { folderPath });

  if (data.code === "error") {
    return { success: false, status: upstreamStatus(data.httpStatus), message: data.message };
  }

  await Promise.all(
    affectedMedia.map((m) => propagateMediaDelete(`${m.folder}/${m.filename}`))
  );

  await Media.deleteMany({ folder: { $regex: `^${escapeRegex(normalizedFolder)}(/|$)` } });

  return { success: true, message: "Folder deleted successfully!" };
};

export const renameFolder = async (folderPath: string, newFolderName: string) => {
  const data = await fmSend("patch", "folders/name", { folderPath, newFolderName });

  if (data.code === "error") {
    return { success: false, status: upstreamStatus(data.httpStatus), message: data.message };
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
    return { success: false, status: 409, message: "Folder is already in that location!" };
  }

  const data = await fmSend("patch", "folders/location", {
    folderPath: normalizedSource,
    targetFolder: normalizedTarget,
  });

  if (data.code === "error") {
    return { success: false, status: upstreamStatus(data.httpStatus), message: data.message };
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
    return { success: false, status: 409, message: "File is already in the target folder!" };
  }

  const data = await fmSend("patch", "files/location", { folder, fileName, targetFolder: targetFolderFull });

  if (data.code === "error") {
    return { success: false, status: upstreamStatus(data.httpStatus), message: data.message };
  }

  await Media.updateOne({ folder, filename: fileName }, { folder: targetFolderFull });
  await propagateMediaRename(`${folder}/${fileName}`, `${targetFolderFull}/${fileName}`);

  return { success: true, message: "File moved successfully!" };
};
