import { NextFunction, Request, Response } from "express";
import * as settingService from "../../services/admin/setting.service";

export const assetVersion = async (_req: Request, res: Response, next: NextFunction) => {
  const settingAssetVersion = await settingService.getSettingByKey<{ assetVersion?: string }>("assetVersion");
  const assetVersion = settingAssetVersion?.data?.assetVersion || "";
  res.locals.assetVersion = assetVersion;
  next();
};

export const general = async (_req: Request, res: Response, next: NextFunction) => {
  const record = await settingService.getSettingByKey("general");
  res.locals.settingGeneral = record?.data || {};
  next();
};
