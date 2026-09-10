import { NextFunction, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { getGeneral, getAssetVersion } from "../../configs/setting.config";

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

const ASSET_BUILD_ID = computeAssetBuildId();

export const assetVersion = async (_req: Request, res: Response, next: NextFunction) => {
  const settingAssetVersion = await getAssetVersion();
  const manualVersion = settingAssetVersion?.assetVersion;

  const autoVersion = ASSET_BUILD_ID;
  res.locals.assetVersion = manualVersion ? `${autoVersion}-${manualVersion}` : autoVersion;
  next();
};

export const general = async (_req: Request, res: Response, next: NextFunction) => {
  const data = await getGeneral();
  res.locals.settingGeneral = data || {};
  next();
};
