import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { permissionList } from "../../configs/variable.config";
import AccountAdmin from "../../models/account-admin.model";
import Role from "../../models/role.model";

const knownPermissions = new Set(permissionList.map((item) => item.id));

const deny = (res: Response, message: string) => {
  res.status(403).json({ code: "error", message });
};

const isSuper = (res: Response): boolean => Boolean(res.locals.accountAdmin?.isSuperAdmin);

const actorPermissions = (res: Response): Set<string> => new Set<string>(res.locals.permissions || []);

const isSubset = (needed: Iterable<string>, held: Set<string>): boolean => {
  for (const permission of needed) {
    if (!held.has(permission)) return false;
  }
  return true;
};

const validIds = (raw: unknown): string[] | null => {
  const list = Array.isArray(raw) ? raw : raw === undefined ? [] : null;
  if (!list) return null;
  if (!list.every((id) => typeof id === "string" && mongoose.isValidObjectId(id))) return null;
  return list as string[];
};

const idsFromRequest = (req: Request): string[] | null => {
  if (req.params.id !== undefined) return mongoose.isValidObjectId(req.params.id) ? [req.params.id] : null;
  return validIds(req.body?.ids);
};

export const guardRolePermissions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const raw = req.body?.permissions;
    let permissions: unknown = [];
    if (typeof raw === "string" && raw !== "") {
      permissions = JSON.parse(raw);
    } else if (Array.isArray(raw)) {
      permissions = raw;
    }

    if (!Array.isArray(permissions) || !permissions.every((item) => typeof item === "string" && knownPermissions.has(item))) {
      deny(res, "Invalid permission list!");
      return;
    }
    const requested = [...new Set(permissions as string[])];

    if (!isSuper(res)) {
      const held = actorPermissions(res);
      if (!isSubset(requested, held)) {
        deny(res, "You cannot grant permissions you do not hold.");
        return;
      }
      if (req.params.id && mongoose.isValidObjectId(req.params.id)) {
        const existing = await Role.findOne({ _id: req.params.id }).select("permissions");
        if (existing && !isSubset(existing.permissions || [], held)) {
          deny(res, "You cannot modify a role that has permissions you do not hold.");
          return;
        }
      }
    }

    req.body.permissions = JSON.stringify(requested);
    next();
  } catch {
    deny(res, "Invalid permission list!");
  }
};

export const guardRoleTargets = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ids = idsFromRequest(req);
    if (!ids) {
      deny(res, "Invalid data!");
      return;
    }
    if (!isSuper(res) && ids.length > 0) {
      const held = actorPermissions(res);
      const roles = await Role.find({ _id: { $in: ids } }).select("permissions");
      if (roles.some((role) => !isSubset(role.permissions || [], held))) {
        deny(res, "You cannot modify a role that has permissions you do not hold.");
        return;
      }
    }
    next();
  } catch {
    deny(res, "Invalid data!");
  }
};

const permissionsOfAccount = async (roleIds: string[]): Promise<string[]> => {
  const valid = roleIds.filter((id) => mongoose.isValidObjectId(id));
  if (valid.length === 0) return [];
  const roles = await Role.find({ _id: { $in: valid }, deleted: false, status: "active" }).select("permissions");
  return roles.flatMap((role) => role.permissions || []);
};

export const guardAdminTargets = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ids = idsFromRequest(req);
    if (!ids) {
      deny(res, "Invalid data!");
      return;
    }
    if (!isSuper(res) && ids.length > 0) {
      const held = actorPermissions(res);
      const actorId = String(res.locals.accountAdmin?.id || "");
      const targets = await AccountAdmin.find({ _id: { $in: ids.filter((id) => id !== actorId) } }).select("roles isSuperAdmin");
      for (const target of targets) {
        if (target.isSuperAdmin || !isSubset(await permissionsOfAccount(target.roles || []), held)) {
          deny(res, "You cannot manage an account that has more permissions than you.");
          return;
        }
      }
    }
    next();
  } catch {
    deny(res, "Invalid data!");
  }
};
