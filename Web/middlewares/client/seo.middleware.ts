import { Request, Response, NextFunction } from "express";
import { getGeneral } from "../../configs/setting.config";

export const canonical = async (req: Request, res: Response, next: NextFunction) => {
  const path = req.originalUrl.split("?")[0];

  const general = await getGeneral();
  const configured = (general?.domainWebsite || "").replace(/\/+$/, "");
  const base = configured || `${req.protocol}://${req.get("host")}`;

  res.locals.canonicalUrl = `${base}${path}`;

  res.locals.allowThirdPartyWidgets = !/^\/(checkout|auth|dashboard|order)(\/|$)/.test(req.path);
  next();
};
