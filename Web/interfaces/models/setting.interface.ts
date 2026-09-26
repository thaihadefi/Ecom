import { Document } from "mongoose";
import { SocialLinkKey } from "../../configs/social-links.config";

export interface ISettingGeneral extends Partial<Record<SocialLinkKey, string>> {
  websiteName?: string;
  /** Short text under the footer logo */
  storeDescription?: string;
  domainWebsite?: string;
  logo?: string;
  favicon?: string;
  shopSenderName?: string;
  shopSenderPhone?: string;
  shopSenderAddress?: string;
  contactEmail?: string;
  shopLat?: string | number;
  shopLng?: string | number;
}

export interface ISettingApiShipping {
  /** Grams per unit for products without their own weight */
  defaultItemWeight?: number;
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
  /** Payment method ids offered at checkout; unset means every configured method */
  enabledMethods?: string[];
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
