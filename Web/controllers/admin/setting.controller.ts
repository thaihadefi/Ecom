import { Request, Response } from 'express';
import { RequestAccount } from '../../interfaces/request.interface';
import { logAdminAction } from '../../helpers/log.helper';
import * as settingService from '../../services/admin/setting.service';

export const apiShipping = async (_req: Request, res: Response) => {
  const key = "apiShipping";
  const record = await settingService.getSettingByKey(key);

  res.render("admin/pages/setting-api-shipping", {
    pageTitle: "Shipping API",
    record: record
  });
};

export const apiShippingPatch = async (req: RequestAccount, res: Response) => {
  const { tokenGoShip, goshipApiUrl } = req.body;
  const key = "apiShipping";
  const data = {
    tokenGoShip: tokenGoShip,
    goshipApiUrl: goshipApiUrl
  };

  await settingService.updateSettingByKey(key, data, req.adminId);

  res.json({
    code: "success",
    message: "Updated successfully!"
  });
};

export const apiPayment = async (_req: Request, res: Response) => {
  const key = "apiPayment";
  const record = await settingService.getSettingByKey(key);

  res.render("admin/pages/setting-api-payment", {
    pageTitle: "Payment Gateway API",
    record: record
  });
};

export const apiPaymentPatch = async (req: RequestAccount, res: Response) => {
  const key = "apiPayment";
  await settingService.updateSettingByKey(key, req.body, req.adminId);

  res.json({
    code: "success",
    message: "Updated successfully!"
  });
};

export const apiLoginSocial = async (_req: Request, res: Response) => {
  const key = "apiLoginSocial";
  const record = await settingService.getSettingByKey(key);

  res.render("admin/pages/setting-api-login-social", {
    pageTitle: "Social Login API",
    record: record
  });
};

export const apiLoginSocialPatch = async (req: RequestAccount, res: Response) => {
  const key = "apiLoginSocial";
  await settingService.updateSettingByKey(key, req.body, req.adminId);

  res.json({
    code: "success",
    message: "Updated successfully!"
  });
};

export const apiAppPassword = async (_req: Request, res: Response) => {
  const key = "apiAppPassword";
  const record = await settingService.getSettingByKey(key);

  res.render("admin/pages/setting-api-app-password", {
    pageTitle: "Google App Password API",
    record: record
  });
};

export const apiAppPasswordPatch = async (req: RequestAccount, res: Response) => {
  const key = "apiAppPassword";
  await settingService.updateSettingByKey(key, req.body, req.adminId);

  res.json({
    code: "success",
    message: "Updated successfully!"
  });
};

export const general = async (_req: Request, res: Response) => {
  const key = "general";
  const record = await settingService.getSettingByKey(key);

  res.render("admin/pages/setting-general", {
    pageTitle: "General Settings",
    record: record
  });
};

export const generalPatch = async (req: RequestAccount, res: Response) => {
  const key = "general";
  await settingService.updateSettingByKey(key, req.body, req.adminId);

  logAdminAction(req, "Updated general settings");

  res.json({
    code: "success",
    message: "Updated successfully!"
  });
};

export const removeCachePatch = async (req: RequestAccount, res: Response) => {
  await settingService.clearAssetCache(req.adminId);

  logAdminAction(req, "Cleared asset cache");

  res.json({
    code: "success",
    message: "Cache cleared successfully!"
  });
};
