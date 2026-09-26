import { MongoMemoryReplSet } from "mongodb-memory-server-core";
import mongoose from "mongoose";
import { invalidateSettingCache } from "../../configs/setting.config";
import { loadStorefront } from "../../configs/storefront.config";
import { metadataCache } from "../../helpers/metadata-cache.helper";
import Setting from "../../models/setting.model";

let replSet: MongoMemoryReplSet | null = null;

// Each test file runs its own throwaway replica set (checkout uses transactions).
export const startTestDb = async (): Promise<void> => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  await mongoose.connect(replSet.getUri("ecom-test"));
  await Promise.all(Object.values(mongoose.models).map((model) => model.createCollection().catch(() => undefined)));
};

export const stopTestDb = async (): Promise<void> => {
  await mongoose.disconnect();
  await replSet?.stop();
  replSet = null;
};

export const resetTestDb = async (): Promise<void> => {
  const db = mongoose.connection.db;
  if (!db) throw new Error("Test database is not connected");
  const collections = await db.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
  invalidateSettingCache();
  metadataCache.flushAll();
  await loadStorefront();
};

export const setSetting = async (key: string, data: object): Promise<void> => {
  await Setting.updateOne({ key }, { $set: { key, data } }, { upsert: true });
  invalidateSettingCache(key);
  if (key === "storefront") await loadStorefront();
};
