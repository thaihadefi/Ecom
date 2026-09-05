import { Model } from "mongoose";
import NodeCache from "node-cache";
import AccountAdmin from "../models/account-admin.model";
import AccountUser from "../models/account-user.model";

type PresenceRole = "admin" | "user";

interface LastSeenDoc {
  _id: unknown;
  lastSeenAt?: Date;
}

const cache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });

const cacheKey = (role: PresenceRole, id: string): string => `lastseen:${role}:${id}`;

const modelFor = (role: PresenceRole): Model<LastSeenDoc> =>
  (role === "admin" ? AccountAdmin : AccountUser) as unknown as Model<LastSeenDoc>;

const logError = (label: string, err: unknown): void => {
  console.error(`[Presence] ${label}:`, err instanceof Error ? err.message : err);
};

export const touchLastSeen = async (role: PresenceRole, id: string): Promise<Date> => {
  const now = new Date();
  cache.set(cacheKey(role, id), now.getTime());
  try {
    await modelFor(role).updateOne({ _id: id }, { $set: { lastSeenAt: now } });
  } catch (err) {
    logError(`touchLastSeen ${role}:${id}`, err);
  }
  return now;
};

export const touchLastSeenMany = async (role: PresenceRole, ids: string[]): Promise<void> => {
  if (ids.length === 0) return;
  const now = new Date();
  const nowMs = now.getTime();
  for (const id of ids) cache.set(cacheKey(role, id), nowMs);
  try {
    await modelFor(role).bulkWrite(
      ids.map(id => ({ updateOne: { filter: { _id: id }, update: { $set: { lastSeenAt: now } } } })),
      { ordered: false },
    );
  } catch (err) {
    logError(`touchLastSeenMany ${role}`, err);
  }
};

export const getLastSeen = async (role: PresenceRole, id: string): Promise<number | undefined> => {
  const cached = cache.get<number>(cacheKey(role, id));
  if (cached !== undefined) return cached;
  try {
    const doc = await modelFor(role).findById(id).select("lastSeenAt").lean();
    if (!doc?.lastSeenAt) return undefined;
    const ts = new Date(doc.lastSeenAt).getTime();
    cache.set(cacheKey(role, id), ts);
    return ts;
  } catch (err) {
    logError(`getLastSeen ${role}:${id}`, err);
    return undefined;
  }
};

export const getLastSeenMany = async (
  role: PresenceRole,
  ids: string[],
): Promise<Record<string, number>> => {
  const result: Record<string, number> = {};
  const missing: string[] = [];

  for (const id of ids) {
    const cached = cache.get<number>(cacheKey(role, id));
    if (cached !== undefined) result[id] = cached;
    else missing.push(id);
  }

  if (missing.length > 0) {
    try {
      const docs = await modelFor(role)
        .find({ _id: { $in: missing } })
        .select("lastSeenAt")
        .lean();
      for (const doc of docs) {
        if (!doc.lastSeenAt) continue;
        const id = String(doc._id);
        const ts = new Date(doc.lastSeenAt).getTime();
        result[id] = ts;
        cache.set(cacheKey(role, id), ts);
      }
    } catch (err) {
      logError(`getLastSeenMany ${role}`, err);
    }
  }

  return result;
};
