import NodeCache from "node-cache";
import Setting from "../models/setting.model";
import {
  ISettingGeneral,
  ISettingApiShipping,
  ISettingApiPayment,
  ISettingApiLoginSocial,
  ISettingApiAppPassword
} from "../interfaces/models/setting.interface";

const settingCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

const getSetting = async <T = Record<string, unknown>>(key: string): Promise<T> => {
  const cached = settingCache.get<T>(key);
  if (cached !== undefined) return cached;
  const setting = await Setting.findOne({ key }).select("data");
  const data = ((setting?.data as unknown) as T) ?? ({} as T);
  settingCache.set(key, data);
  return data;
};

export const invalidateSettingCache = (key: string) => settingCache.del(key);

export const getApiShipping = (): Promise<ISettingApiShipping> => getSetting<ISettingApiShipping>("apiShipping");
export const getApiPayment = (): Promise<ISettingApiPayment> => getSetting<ISettingApiPayment>("apiPayment");
export const getApiLoginSocial = (): Promise<ISettingApiLoginSocial> => getSetting<ISettingApiLoginSocial>("apiLoginSocial");
export const getApiAppPassword = (): Promise<ISettingApiAppPassword> => getSetting<ISettingApiAppPassword>("apiAppPassword");
export const getGeneral = (): Promise<ISettingGeneral> => getSetting<ISettingGeneral>("general");
