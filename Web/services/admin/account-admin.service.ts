import bcrypt from "bcryptjs";
import Role from '../../models/role.model';
import AccountAdmin from '../../models/account-admin.model';
import { IAccountAdmin, IAccountAdminInput } from '../../interfaces/models/account-admin.interface';
import { toSearchText } from '../../helpers/slugify.helper';
import { escapeRegex } from '../../helpers/generate.helper';
import { PAGINATION } from '../../configs/pagination.config';
import { getPagination } from '../../helpers/pagination.helper';
import { restoreMany, getTrash } from "../../helpers/admin-crud.helper";

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
): Promise<{ success: boolean; message: string; account?: IAccountAdmin }> => {
  const existAccount = await AccountAdmin.findOne({
    email: String(data.email || ""),
    deleted: false
  }).select("_id");

  if (existAccount) {
    return { success: false, message: "Email already exists!" };
  }

  if (typeof data.roles === "string") {
    data.roles = [data.roles];
  }

  const canGrant = await canActorGrantRoles(actorIsSuperAdmin, actorPermissions, (data.roles as string[]) || []);
  if (!canGrant) {
    return { success: false, message: "You cannot assign a role with permissions you do not hold." };
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
): Promise<{ success: boolean; message: string }> => {
  const accountDetail = await AccountAdmin.findOne({ _id: id, deleted: false });

  if (!accountDetail) {
    return { success: false, message: "Account does not exist!" };
  }

  if (accountDetail.isSuperAdmin && actorId !== id) {
    return { success: false, message: "Cannot modify a superadmin account." };
  }

  if (actorId === id && data.status && data.status !== "active") {
    return { success: false, message: "Cannot deactivate your own account." };
  }

  const existEmail = await AccountAdmin.findOne({
    email: String(data.email || ""),
    deleted: false,
    _id: { $ne: id }
  }).select("_id");

  if (existEmail) {
    return { success: false, message: "Email already in use by another account!" };
  }

  if (typeof data.roles === "string") {
    data.roles = JSON.parse(data.roles);
  }

  const canGrant = await canActorGrantRoles(actorIsSuperAdmin, actorPermissions, (data.roles as string[]) || []);
  if (!canGrant) {
    return { success: false, message: "You cannot assign a role with permissions you do not hold." };
  }

  data.search = toSearchText(`${data.fullName} ${data.email}`);
  await AccountAdmin.updateOne({ _id: id, deleted: false }, data);

  return { success: true, message: "Updated successfully!" };
};

export const changeAdminPassword = async (
  id: string,
  newPassword: string,
  actorId: string
) => {
  const accountDetail = await AccountAdmin.findOne({ _id: id, deleted: false });

  if (!accountDetail) {
    return { success: false, message: "Account does not exist!" };
  }

  if (accountDetail.isSuperAdmin && actorId !== id) {
    return { success: false, message: "Cannot change password of a superadmin account." };
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await AccountAdmin.updateOne({ _id: id, deleted: false }, { password: hashedPassword });

  return { success: true, message: "Password changed successfully!" };
};

export const softDeleteAdminAccount = async (id: string) => {
  const target = await AccountAdmin.findOne({ _id: id, deleted: false }).select("isSuperAdmin");
  if (target?.isSuperAdmin) {
    return { success: false, message: "Cannot delete a superadmin account." };
  }

  await AccountAdmin.updateOne({ _id: id }, { deleted: true, deletedAt: Date.now() });
  return { success: true, message: "Account deleted successfully!" };
};

export const softDeleteManyAdminAccounts = async (ids: string[]) => {
  
  await AccountAdmin.updateMany({ _id: { $in: ids }, isSuperAdmin: false }, { deleted: true, deletedAt: new Date() });
  return { success: true, message: `Moved ${ids.length} account(s) to trash!` };
};

export const restoreAdminAccount = async (id: string) => {
  await AccountAdmin.updateOne({ _id: id }, { deleted: false });
  return { success: true, message: "Restored successfully!" };
};

export const restoreManyAdminAccounts = (ids: string[]) => restoreMany(AccountAdmin, ids, "account");

export const permanentlyDeleteAdminAccount = async (id: string) => {
  await AccountAdmin.deleteOne({ _id: id, isSuperAdmin: false });
  return { success: true, message: "Deleted permanently!" };
};

export const permanentlyDeleteManyAdminAccounts = async (ids: string[]) => {
  await AccountAdmin.deleteMany({ _id: { $in: ids }, isSuperAdmin: false });
  return { success: true, message: `Deleted ${ids.length} admin account(s) permanently!` };
};

export const getAdminAccountTrash = () => getTrash(AccountAdmin, "_id fullName email status deletedAt");
