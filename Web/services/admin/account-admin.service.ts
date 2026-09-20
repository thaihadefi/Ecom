import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import Role from '../../models/role.model';
import AccountAdmin from '../../models/account-admin.model';
import { IAccountAdmin, IAccountAdminInput } from '../../interfaces/models/account-admin.interface';
import { toSearchText } from '../../helpers/slugify.helper';
import { escapeRegex } from '../../helpers/generate.helper';
import { PAGINATION } from '../../configs/pagination.config';
import { getPagination } from '../../helpers/pagination.helper';
import { restoreMany, getTrash } from "../../helpers/admin-crud.helper";
import { invalidateAdminAuthCache } from "./auth.service";
import { revokeRefreshTokens } from "../../helpers/token-rotation.helper";

export const parseRoleIds = (raw: unknown): string[] | null => {
  let list: unknown = raw;
  if (typeof raw === "string") {
    if (raw.trim() === "") return [];
    try {
      list = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (list === undefined || list === null) return [];
  if (!Array.isArray(list) || !list.every((id) => typeof id === "string" && mongoose.isValidObjectId(id))) return null;
  return [...new Set(list as string[])];
};

export const canActorGrantRoles = async (
  actorIsSuperAdmin: boolean,
  actorPermissions: string[],
  roleIds: string[]
): Promise<boolean> => {
  if (actorIsSuperAdmin) return true;
  const roles = await Role.find({ _id: { $in: roleIds }, deleted: false, status: "active" }).select("_id permissions");
  if (roles.length !== roleIds.length) return false;
  return roles.every(role =>
    (role.permissions || []).every((p: string) => actorPermissions.includes(p))
  );
};

export const getRolesForSelect = async () => {
  return Role.find({ deleted: false, status: "active" }).select("_id name");
};

export const createAdminAccount = async (
  data: IAccountAdminInput,
  actorIsSuperAdmin: boolean,
  actorPermissions: string[]
): Promise<{ success: boolean; status?: number; message: string; account?: IAccountAdmin }> => {
  const existAccount = await AccountAdmin.findOne({
    email: String(data.email || ""),
    deleted: false
  }).select("_id");

  if (existAccount) {
    return { success: false, status: 409, message: "Email already exists!" };
  }

  const roleIds = parseRoleIds(data.roles);
  if (!roleIds) {
    return { success: false, status: 400, message: "Invalid role selection!" };
  }
  data.roles = roleIds;

  const canGrant = await canActorGrantRoles(actorIsSuperAdmin, actorPermissions, roleIds);
  if (!canGrant) {
    return { success: false, status: 403, message: "You cannot assign a role with permissions you do not hold." };
  }

  if (data.password) {
    data.password = await bcrypt.hash(String(data.password), 10);
  }

  data.search = toSearchText(`${data.fullName} ${data.email}`);
  const newRecord = new AccountAdmin(data);
  await newRecord.save();

  return { success: true, message: "Admin account created successfully!", account: newRecord };
};

export const getAdminAccountList = async (rawKeyword?: unknown, rawPage?: unknown) => {
  const find: {
    deleted: boolean;
    search?: RegExp;
  } = {
    deleted: false
  };

  if (rawKeyword) {
    const keyword = toSearchText(`${rawKeyword}`);
    const keywordRegex = new RegExp(escapeRegex(keyword), "i");
    find.search = keywordRegex;
  }

  const limitItems = PAGINATION.ADMIN_LIMIT;
  const totalRecord = await AccountAdmin.countDocuments(find);
  const pagination = getPagination(rawPage, limitItems, totalRecord);

  const recordList = await AccountAdmin
    .find(find)
    .select("-password -search")
    .limit(limitItems)
    .skip(pagination.skip)
    .sort({ createdAt: "desc" });

  const allRoleIds = [...new Set(recordList.flatMap((item) => item.roles || []))];
  const allRoles = allRoleIds.length > 0
    ? await Role.find({ _id: { $in: allRoleIds } }).select("_id name")
    : [];
  const roleMap = new Map((allRoles as Array<{ _id: unknown; name?: string }>).map((r) => [String(r._id), r.name]));

  for (const item of recordList) {
    item.rolesName = (item.roles || []).map((id: string) => roleMap.get(String(id))).filter(Boolean) as string[];
  }

  return {
    recordList,
    pagination
  };
};

export const getAdminAccountById = async (id: string) => {
  return AccountAdmin.findOne({ _id: id, deleted: false });
};

export const updateAdminAccount = async (
  id: string,
  data: IAccountAdminInput,
  actorId: string,
  actorIsSuperAdmin: boolean,
  actorPermissions: string[]
): Promise<{ success: boolean; status?: number; message: string }> => {
  const accountDetail = await AccountAdmin.findOne({ _id: id, deleted: false });

  if (!accountDetail) {
    return { success: false, status: 404, message: "Account does not exist!" };
  }

  if (accountDetail.isSuperAdmin && actorId !== id) {
    return { success: false, status: 403, message: "Cannot modify a superadmin account." };
  }

  if (actorId === id && data.status && data.status !== "active") {
    return { success: false, status: 403, message: "Cannot deactivate your own account." };
  }

  const existEmail = await AccountAdmin.findOne({
    email: String(data.email || ""),
    deleted: false,
    _id: { $ne: id }
  }).select("_id");

  if (existEmail) {
    return { success: false, status: 409, message: "Email already in use by another account!" };
  }

  const roleIds = parseRoleIds(data.roles);
  if (!roleIds) {
    return { success: false, status: 400, message: "Invalid role selection!" };
  }
  data.roles = roleIds;

  const canGrant = await canActorGrantRoles(actorIsSuperAdmin, actorPermissions, roleIds);
  if (!canGrant) {
    return { success: false, status: 403, message: "You cannot assign a role with permissions you do not hold." };
  }

  data.search = toSearchText(`${data.fullName} ${data.email}`);
  await AccountAdmin.updateOne({ _id: id, deleted: false }, data);
  invalidateAdminAuthCache(id);

  return { success: true, message: "Updated successfully!" };
};

export const changeAdminPassword = async (
  id: string,
  newPassword: string,
  actorId: string
) => {
  const accountDetail = await AccountAdmin.findOne({ _id: id, deleted: false });

  if (!accountDetail) {
    return { success: false, status: 404, message: "Account does not exist!" };
  }

  if (accountDetail.isSuperAdmin && actorId !== id) {
    return { success: false, status: 403, message: "Cannot change password of a superadmin account." };
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await AccountAdmin.updateOne({ _id: id, deleted: false }, { password: hashedPassword, passwordChangedAt: new Date() });
  await revokeRefreshTokens(id, "admin");
  invalidateAdminAuthCache(id);

  return { success: true, message: "Password changed successfully!" };
};

export const softDeleteAdminAccount = async (id: string) => {
  const target = await AccountAdmin.findOne({ _id: id, deleted: false }).select("isSuperAdmin");
  if (target?.isSuperAdmin) {
    return { success: false, status: 403, message: "Cannot delete a superadmin account." };
  }

  await AccountAdmin.updateOne({ _id: id }, { deleted: true, deletedAt: Date.now() });
  invalidateAdminAuthCache(id);
  return { success: true, message: "Account deleted successfully!" };
};

export const softDeleteManyAdminAccounts = async (ids: string[]) => {
  const result = await AccountAdmin.updateMany({ _id: { $in: ids }, isSuperAdmin: false }, { deleted: true, deletedAt: new Date() });
  invalidateAdminAuthCache();
  return { success: true, message: `Moved ${result.modifiedCount} account(s) to trash!` };
};

export const restoreAdminAccount = async (id: string) => {
  await AccountAdmin.updateOne({ _id: id }, { deleted: false });
  invalidateAdminAuthCache(id);
  return { success: true, message: "Restored successfully!" };
};

export const restoreManyAdminAccounts = (ids: string[]) => {
  invalidateAdminAuthCache();
  return restoreMany(AccountAdmin, ids, "account");
};

export const permanentlyDeleteAdminAccount = async (id: string) => {
  await AccountAdmin.deleteOne({ _id: id, isSuperAdmin: false });
  invalidateAdminAuthCache(id);
  return { success: true, message: "Deleted permanently!" };
};

export const permanentlyDeleteManyAdminAccounts = async (ids: string[]) => {
  const result = await AccountAdmin.deleteMany({ _id: { $in: ids }, isSuperAdmin: false });
  invalidateAdminAuthCache();
  return { success: true, message: `Deleted ${result.deletedCount} admin account(s) permanently!` };
};

export const getAdminAccountTrash = () => getTrash(AccountAdmin, "_id fullName email status deletedAt");
