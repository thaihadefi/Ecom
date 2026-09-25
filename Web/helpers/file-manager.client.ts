import FormData from "form-data";
import axios from "axios";
import { domainCDN } from "../configs/variable.config";

const bearerHeader = () => ({ Authorization: `Bearer ${process.env.FILE_MANAGER_SECRET}` });

const authHeaders = (form: FormData) => ({
  ...form.getHeaders(),
  ...bearerHeader(),
});

type SavedLink = { folder: string; filename: string };

export const fmUpload = async (
  files: Express.Multer.File[],
  folderPath: string,
): Promise<{ success: boolean; fileUrls: string[]; status?: number; message?: string }> => {
  const form = new FormData();
  files.forEach((file) => {
    form.append("files", file.buffer, { filename: file.originalname, contentType: file.mimetype });
  });
  form.append("folderPath", folderPath);

  const res = await axios.post(`${domainCDN}/files`, form, { headers: authHeaders(form), validateStatus: () => true });
  if (res.status >= 400 || res.data.code === "error") return { success: false, fileUrls: [], status: res.status, message: res.data?.message };

  const saveLinks: SavedLink[] = res.data.saveLinks || [];
  return { success: true, fileUrls: saveLinks.map((l) => `${l.folder}/${l.filename}`) };
};

export const fmDeleteFile = (folder: string, fileName: string): void => {
  axios
    .delete(`${domainCDN}/files`, { params: { folder, fileName }, headers: bearerHeader() })
    .catch((err: unknown) => {
      if (isAlreadyGone(err)) return;
      const msg = err instanceof Error ? err.message : "unknown error";
      console.error(`[FileManager] orphan file, delete failed: ${folder}/${fileName} (${msg})`);
    });
};

// Deletes are idempotent: a file or folder that no longer exists is already in the wanted state.
const isAlreadyGone = (err: unknown): boolean => axios.isAxiosError(err) && err.response?.status === 404;

export const fmDeleteByLink = (link: string): void => {
  const i = link.lastIndexOf("/");
  fmDeleteFile(link.slice(0, i), link.slice(i + 1));
};

export const fmDeleteFolder = (folderPath: string): void => {
  axios
    .delete(`${domainCDN}/folders`, { params: { folderPath }, headers: bearerHeader() })
    .catch((err: unknown) => {
      if (isAlreadyGone(err)) return;
      const msg = err instanceof Error ? err.message : "unknown error";
      console.error(`[FileManager] orphan folder, delete failed: ${folderPath} (${msg})`);
    });
};
