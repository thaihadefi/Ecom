import { NextFunction, Request, Response } from "express";
import Setting from "../../models/setting.model";

export const assetVersion = async (req: Request, res: Response, next: NextFunction) => {
  const settingAssetVersion = await Setting.findOne({
    key: "assetVersion"
  }).select("data")
  const assetVersion = settingAssetVersion ? settingAssetVersion.data.assetVersion : "";
  res.locals.assetVersion = assetVersion;
  next();
}

export const general = async (req: Request, res: Response, next: NextFunction) => {
  const record = await Setting.findOne({ key: "general" }).select("data");
  res.locals.settingGeneral = record ? record.data : {};
  next();
}