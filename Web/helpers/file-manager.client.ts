import FormData from "form-data";
import axios from "axios";
import { domainCDN } from "../configs/variable.config";

/**
 * Thin client for the FileManager microservice. The base URL, bearer auth and
 * the fire-and-forget delete + orphan logging live here instead of being
 * re-typed in every service that touches uploads (chat, avatar, review images).
 */

const authHeaders = (form: FormData) => ({
  ...form.getHeaders(),
  Authorization: `Bearer ${process.env.FILE_MANAGER_SECRET}`,
});

type SavedLink = { folder: string; filename: string };

/** Upload file buffers and return their stored "folder/filename" links. */
export const fmUpload = async (
  files: Express.Multer.File[],
  folderPath: string,
): Promise<{ success: boolean; fileUrls: string[] }> => {
  const form = new FormData();
  files.forEach((file) => {
    form.append("files", file.buffer, { filename: file.originalname, contentType: file.mimetype });
  });
  form.append("folderPath", folderPath);

  const res = await axios.post(`${domainCDN}/file-manager/upload`, form, { headers: authHeaders(form) });
  if (res.data.code === "error") return { success: false, fileUrls: [] };

  const saveLinks: SavedLink[] = res.data.saveLinks || [];
  return { success: true, fileUrls: saveLinks.map((l) => `${l.folder}/${l.filename}`) };
};

/** Fire-and-forget delete of one file; logs the path if the FileManager is down. */
export const fmDeleteFile = (folder: string, fileName: string): void => {
  const form = new FormData();
  form.append("folder", folder);
  form.append("fileName", fileName);
  axios
    .patch(`${domainCDN}/file-manager/delete-file`, form, { headers: authHeaders(form) })
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : "unknown error";
      console.error(`[FileManager] orphan file, delete failed: ${folder}/${fileName} (${msg})`);
    });
};

/** Delete a file by its stored "folder/filename" link. */
export const fmDeleteByLink = (link: string): void => {
  const i = link.lastIndexOf("/");
  fmDeleteFile(link.slice(0, i), link.slice(i + 1));
};

/** Fire-and-forget delete of a whole folder. */
export const fmDeleteFolder = (folderPath: string): void => {
  const form = new FormData();
  form.append("folderPath", folderPath);
  axios
    .patch(`${domainCDN}/file-manager/folder/delete`, form, { headers: authHeaders(form) })
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : "unknown error";
      console.error(`[FileManager] orphan folder, delete failed: ${folderPath} (${msg})`);
    });
};
