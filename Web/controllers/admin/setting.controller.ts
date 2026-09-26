import { Request, Response } from 'express';
import { RequestAccount } from '../../interfaces/request.interface';
import { logAdminAction } from '../../helpers/log.helper';
import passport from 'passport';
import { configureGooglePassport } from '../../configs/googleOauth.config';
import { configureFacebookPassport } from '../../configs/facebookOauth.config';
import * as settingService from '../../services/admin/setting.service';
import { PAYMENT_METHODS, PaymentMethodDefinition, supportsStoreCurrency } from '../../configs/payment-methods.config';
import { ISettingApiPayment } from '../../interfaces/models/setting.interface';
import { SHIPPING_CONFIG } from '../../configs/shipping.config';
import { SOCIAL_LINKS } from '../../configs/social-links.config';
import { CONTENT_PAGES, ContentPageKey } from '../../configs/content-pages.config';
import { loadStorefront, normalizeStorefront, StorefrontSettings } from '../../configs/storefront.config';

export const apiShipping = async (_req: Request, res: Response) => {
  const key = "apiShipping";
  const record = await settingService.getSettingByKey(key);

  res.render("admin/pages/setting-api-shipping", {
    pageTitle: "Shipping",
    record: record,
    defaultItemWeight: SHIPPING_CONFIG.DEFAULT_ITEM_WEIGHT_GRAMS
  });
};

export const apiShippingPatch = async (req: RequestAccount, res: Response) => {
  await settingService.updateSettingByKey("apiShipping", req.body, req.adminId);

  res.json({
    code: "success",
    message: "Updated successfully!"
  });
};

export const apiPayment = async (_req: Request, res: Response) => {
  const key = "apiPayment";
  const record = await settingService.getSettingByKey(key);

  const data = (record?.data || {}) as ISettingApiPayment;
  const chosen = Array.isArray(data.enabledMethods) ? data.enabledMethods : null;

  res.render("admin/pages/setting-api-payment", {
    pageTitle: "Payment Gateway API",
    record: record,
    paymentMethodOptions: PAYMENT_METHODS.map((m: PaymentMethodDefinition) => ({
      id: m.id,
      label: m.label,
      configured: m.isConfigured(data),
      unsupportedCurrency: supportsStoreCurrency(m) ? "" : (m.currencies || []).join(", "),
      checked: !chosen || chosen.includes(m.id)
    }))
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

  await configureGooglePassport(passport);
  await configureFacebookPassport(passport);

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
    record: record,
    socialLinks: SOCIAL_LINKS
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

export const storefront = async (_req: Request, res: Response) => {
  const record = await settingService.getSettingByKey("storefront");

  res.render("admin/pages/setting-storefront", {
    pageTitle: "Storefront",
    values: normalizeStorefront(record?.data as Partial<StorefrontSettings> | undefined),
    // Intl.supportedValuesOf is ES2022; the compile target (ES6) does not declare it.
    timeZones: (Intl as unknown as { supportedValuesOf(key: "timeZone"): string[] }).supportedValuesOf("timeZone")
  });
};

export const storefrontPatch = async (req: RequestAccount, res: Response) => {
  await settingService.updateSettingByKey("storefront", req.body, req.adminId);
  await loadStorefront();

  logAdminAction(req, "Updated storefront settings");

  res.json({
    code: "success",
    message: "Updated successfully!"
  });
};

export const pages = async (_req: Request, res: Response) => {
  const record = await settingService.getSettingByKey("pages");
  const saved = (record?.data || {}) as Partial<Record<ContentPageKey, string>>;

  res.render("admin/pages/setting-pages", {
    pageTitle: "Page Content",
    pages: CONTENT_PAGES.map((page) => ({ key: page.key, title: page.title, content: saved[page.key] || "" }))
  });
};

export const pagesPatch = async (req: RequestAccount, res: Response) => {
  await settingService.updateSettingByKey("pages", req.body, req.adminId);

  logAdminAction(req, "Updated page content");

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
