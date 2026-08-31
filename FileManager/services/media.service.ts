import path from "path";
import fs from "fs";

const mediaRoot = path.resolve(process.cwd(), "media");

export const resolveMediaFilePath = async (
  subPath: unknown
): Promise<{ status: number; message?: string; filePath?: string }> => {
  if (!subPath || !Array.isArray(subPath)) {
    return { status: 400, message: "Invalid path." };
  }

  const cleanSegments = subPath.filter(
    (seg) => typeof seg === "string" && seg !== "" && seg !== ".." && seg !== "."
  );

  if (cleanSegments.includes("temp")) {
    return { status: 403, message: "Access denied." };
  }

  const mediaPath = path.resolve(mediaRoot, ...cleanSegments);

  if (!mediaPath.startsWith(mediaRoot + path.sep) && mediaPath !== mediaRoot) {
    return { status: 403, message: "Access denied." };
  }

  try {
    const stat = await fs.promises.stat(mediaPath);
    if (!stat.isFile()) {
      return { status: 404, message: "File not found." };
    }
  } catch (err) {
    return { status: 404, message: "File not found." };
  }

  return { status: 200, filePath: mediaPath };
};
