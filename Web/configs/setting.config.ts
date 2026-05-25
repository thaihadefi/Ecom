import NodeCache from "node-cache";
import Setting from "../models/setting.model";

const settingCache = new NodeCache({ stdTTL: 300, checkperiod: 60 }); // 5-min TTL

const getSetting = async (key: string) => {
  const cached = settingCache.get(key);
  if (cached !== undefined) return cached;
  const setting = await Setting.findOne({ key }).select("data");
  const data = setting ? (setting as any).data : null;
  settingCache.set(key, data);
  return data;
};

export const invalidateSettingCache = (key: string) => settingCache.del(key);

export const getApiShipping = () => getSetting("apiShipping");
export const getApiPayment = () => getSetting("apiPayment");
export const getApiLoginSocial = () => getSetting("apiLoginSocial");
export const getApiAppPassword = () => getSetting("apiAppPassword");
export const getGeneral = () => getSetting("general");