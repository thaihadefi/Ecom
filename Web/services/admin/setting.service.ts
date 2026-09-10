import Setting from '../../models/setting.model';
import { ISetting } from '../../interfaces/models/setting.interface';
import { invalidateSettingCache } from '../../configs/setting.config';

export const getSettingByKey = async <T = Record<string, unknown>>(key: string): Promise<ISetting<T> | null> => {
  return Setting.findOne({ key }) as unknown as Promise<ISetting<T> | null>;
};

export const updateSettingByKey = async <T = Record<string, unknown>>(key: string, data: T, adminId?: string): Promise<ISetting<T> | null> => {
  const result = await Setting.findOneAndUpdate(
    { key },
    {
      key,
      data,
      updatedBy: adminId
    },
    { upsert: true, new: true }
  ) as unknown as Promise<ISetting<T> | null>;
  invalidateSettingCache(key);
  return result;
};

export const clearAssetCache = async (adminId?: string): Promise<ISetting | null> => {
  const result = await Setting.findOneAndUpdate(
    { key: "assetVersion" },
    {
      key: "assetVersion",
      data: {
        assetVersion: Date.now()
      },
      updatedBy: adminId
    },
    { upsert: true, new: true }
  );
  invalidateSettingCache("assetVersion");
  return result;
};

