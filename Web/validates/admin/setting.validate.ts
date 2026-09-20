import { NextFunction, Request, Response } from "express";
import Joi from "joi";

const text = (max = 500) => Joi.string().trim().max(max).allow("");
const url = () => Joi.string().trim().uri({ scheme: ["http", "https"] }).max(500).allow("");

const schemas: Record<string, Joi.ObjectSchema> = {
  general: Joi.object({
    websiteName: text(100),
    domainWebsite: url(),
    logo: text(),
    favicon: text(),
    shopSenderName: text(100),
    shopSenderPhone: text(30),
    shopSenderAddress: text(300),
    shopLat: Joi.alternatives().try(Joi.number().min(-90).max(90), Joi.string().allow("")),
    shopLng: Joi.alternatives().try(Joi.number().min(-180).max(180), Joi.string().allow("")),
  }),
  apiShipping: Joi.object({
    tokenGoShip: text(),
    goshipApiUrl: url(),
  }),
  apiPayment: Joi.object({
    zaloPayAppId: text(100),
    zaloPayKey1: text(),
    zaloPayKey2: text(),
    zaloPayDomain: url(),
    zaloPayEndpoint: url(),
    vnPayTmnCode: text(100),
    vnPayHashSecret: text(),
    vnPayURL: url(),
  }),
  apiLoginSocial: Joi.object({
    googleClientId: text(),
    googleClientSecret: text(),
    googleCallbackUrl: url(),
    facebookAppId: text(),
    facebookAppSecret: text(),
    facebookCallbackUrl: url(),
  }),
  apiAppPassword: Joi.object({
    gmailUser: text(200),
    gmailPassword: text(200),
  }),
};

export const settingPatch = (key: keyof typeof schemas) => (req: Request, res: Response, next: NextFunction) => {
  const { error, value } = schemas[key].validate(req.body, { stripUnknown: true });

  if (error) {
    res.status(400).json({ code: "error", message: error.details[0].message });
    return;
  }

  req.body = value;
  next();
};
