import { NextFunction, Request, Response } from "express";
import fs from "fs";
import path from "path";
import * as settingService from "../../services/admin/setting.service";

// Fingerprint of the client asset bundle, computed once per process. It changes
// whenever any file under public/client/assets is modified (i.e. on every
// deploy), so a deploy always busts stale browser caches even if nobody hits
// the admin "clear asset cache" button. The optional DB value is kept as a
// manual override that admins can bump on demand.
const computeAssetBuildId = (): string => {
  const root = path.join(process.cwd(), "public", "client", "assets");
  let latestMtime = 0;
  try {
    const entries = fs.readdirSync(root, { recursive: true }) as string[];
    for (const entry of entries) {
      const full = path.join(root, entry);
      const stat = fs.statSync(full);
      if (stat.isFile() && stat.mtimeMs > latestMtime) latestMtime = stat.mtimeMs;
    }
  } catch {
    // asset dir missing in some contexts — fall back to process start time
  }
  return String(Math.round(latestMtime) || Date.now());
};

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const ASSET_BUILD_ID = computeAssetBuildId();

export const assetVersion = async (_req: Request, res: Response, next: NextFunction) => {
  const settingAssetVersion = await settingService.getSettingByKey<{ assetVersion?: string }>("assetVersion");
  const manualVersion = settingAssetVersion?.data?.assetVersion;

  // Dev: bust every request so asset edits show up without a restart.
  // Prod: pin to a per-deploy id (changes whenever an asset file changes on
  // disk), optionally suffixed with the admin's manual "clear cache" value.
  const autoVersion = IS_PRODUCTION ? ASSET_BUILD_ID : `${Date.now()}`;
  res.locals.assetVersion = manualVersion ? `${autoVersion}-${manualVersion}` : autoVersion;
  next();
};

export const general = async (_req: Request, res: Response, next: NextFunction) => {
  const record = await settingService.getSettingByKey("general");
  res.locals.settingGeneral = record?.data || {};
  next();
};
