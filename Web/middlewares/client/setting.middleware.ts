import { NextFunction, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { getGeneral, getAssetVersion, getApiPayment } from "../../configs/setting.config";
import { enabledPaymentMethods } from "../../configs/payment-methods.config";
import { formatPhone } from "../../helpers/format.helper";

const computeAssetBuildId = (): string => {
  let latestMtime = 0;
  for (const area of ["client", "admin"]) {
    const root = path.join(process.cwd(), "public", area, "assets");
    try {
      const entries = fs.readdirSync(root, { recursive: true }) as string[];
      for (const entry of entries) {
        const stat = fs.statSync(path.join(root, entry));
        if (stat.isFile() && stat.mtimeMs > latestMtime) latestMtime = stat.mtimeMs;
      }
    } catch {
    }
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

  // Contact details shown in the header, footer and pages come from Settings > General; empty fields are hidden.
  const phone = (data?.shopSenderPhone || "").trim();
  const address = (data?.shopSenderAddress || "").trim();
  res.locals.storeContact = {
    phone: formatPhone(phone),
    phoneHref: phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : "",
    address,
    mapUrl: address ? `https://maps.google.com/?q=${encodeURIComponent(address)}` : "",
    email: (data?.contactEmail || "").trim(),
  };
  next();
};

// Payment methods the storefront offers (checkout options and footer icons).
export const paymentMethods = async (_req: Request, res: Response, next: NextFunction) => {
  res.locals.paymentMethods = enabledPaymentMethods(await getApiPayment());
  next();
};
