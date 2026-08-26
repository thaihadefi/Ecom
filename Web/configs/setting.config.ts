import NodeCache from "node-cache";
import Setting from "../models/setting.model";

const settingCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

const getSetting = async (key: string): Promise<Record<string, unknown>> => {
  const cached = settingCache.get<Record<string, unknown>>(key);
  if (cached !== undefined) return cached;
  const setting = await Setting.findOne({ key }).select("data");
  const data = (setting?.data as Record<string, unknown>) ?? {};
  settingCache.set(key, data);
  return data;
};

export const invalidateSettingCache = (key: string) => settingCache.del(key);

export const getApiShipping = () => getSetting("apiShipping");
export const getApiPayment = () => getSetting("apiPayment");
export const getApiLoginSocial = () => getSetting("apiLoginSocial");
export const getApiAppPassword = () => getSetting("apiAppPassword");
export const getGeneral = () => getSetting("general");
