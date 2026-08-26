import { Document } from "mongoose";

export interface ISettingGeneral {
  websiteName?: string;
  domainWebsite?: string;
  logo?: string;
  favicon?: string;
  shopSenderName?: string;
  shopSenderPhone?: string;
  shopSenderAddress?: string;
  shopLat?: string | number;
  shopLng?: string | number;
}

export interface ISettingApiShipping {
  tokenGoShip?: string;
  goshipApiUrl?: string;
}

export interface ISettingApiPayment {
  zaloPayAppId?: string;
  zaloPayKey1?: string;
  zaloPayKey2?: string;
  zaloPayDomain?: string;
  zaloPayEndpoint?: string;
  vnPayTmnCode?: string;
  vnPayHashSecret?: string;
  vnPayURL?: string;
}

export interface ISettingApiLoginSocial {
  googleClientId?: string;
  googleClientSecret?: string;
  googleCallbackUrl?: string;
  facebookAppId?: string;
  facebookAppSecret?: string;
  facebookCallbackUrl?: string;
}

export interface ISettingApiAppPassword {
  gmailUser?: string;
  gmailPassword?: string;
}

export interface ISetting<T = Record<string, unknown>> extends Document {
  id?: string;
  key?: string;
  data?: T;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}
