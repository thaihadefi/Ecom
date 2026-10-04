import { Request, Response, NextFunction } from "express";
import { getGeneral } from "../../configs/setting.config";
import { siteJsonLd } from "../../helpers/structured-data.helper";

// Personal, transactional and result pages stay out of search indexes; links on them are still followed.
const NOINDEX_PATH = /^\/(cart|checkout|auth|dashboard|order|wishlist|compare|search)(\/|$)/;

// Public origin of the store: Settings > General "domainWebsite", or the request's own host.
export const siteOrigin = async (req: Request): Promise<string> => {
  const general = await getGeneral();
  return originFrom(general?.domainWebsite, req);
};

const originFrom = (domainWebsite: string | undefined, req: Request): string => {
  const configured = (domainWebsite || "").replace(/\/+$/, "");
  return configured || `${req.protocol}://${req.get("host")}`;
};

export const canonical = async (req: Request, res: Response, next: NextFunction) => {
  const path = req.originalUrl.split("?")[0];
  const general = await getGeneral();
  const base = originFrom(general?.domainWebsite, req);

  res.locals.siteOrigin = base;
  res.locals.canonicalUrl = `${base}${path}`;
  res.locals.noindex = NOINDEX_PATH.test(req.path);
  res.locals.siteJsonLd = siteJsonLd(general, base);

  res.locals.allowThirdPartyWidgets = !/^\/(checkout|auth|dashboard|order)(\/|$)/.test(req.path);
  next();
};
