import { NextFunction, Request, Response } from "express";
import fs from "fs";
import path from "path";
import * as settingService from "../../services/admin/setting.service";

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
    
  }
  return String(Math.round(latestMtime) || Date.now());
};

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const ASSET_BUILD_ID = computeAssetBuildId();

export const assetVersion = async (_req: Request, res: Response, next: NextFunction) => {
  const settingAssetVersion = await settingService.getSettingByKey<{ assetVersion?: string }>("assetVersion");
  const manualVersion = settingAssetVersion?.data?.assetVersion;

  
  
  const autoVersion = IS_PRODUCTION ? ASSET_BUILD_ID : `${Date.now()}`;
  res.locals.assetVersion = manualVersion ? `${autoVersion}-${manualVersion}` : autoVersion;
  next();
};

export const general = async (_req: Request, res: Response, next: NextFunction) => {
  const record = await settingService.getSettingByKey("general");
  res.locals.settingGeneral = record?.data || {};
  next();
};
