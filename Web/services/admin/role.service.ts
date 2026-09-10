import Role from '../../models/role.model';
import { IRole, IRoleInput } from '../../interfaces/models/role.interface';
import { toSearchText } from '../../helpers/slugify.helper';
import { softDeleteMany, restoreMany, permanentlyDeleteMany, getTrash } from "../../helpers/admin-crud.helper";
import { paginatedSearch } from "../../helpers/list-query.helper";
import { invalidateAdminAuthCache } from "./auth.service";

export const createRole = async (data: IRoleInput): Promise<IRole> => {
  if (typeof data.permissions === "string") {
    data.permissions = JSON.parse(data.permissions);
  }
  data.search = toSearchText(`${data.name}`);

  const newRecord = new Role(data);
  await newRecord.save();
  return newRecord;
};

export const getRoleList = async (rawKeyword?: unknown, rawPage?: unknown) => {
  const { recordList, pagination } = await paginatedSearch(Role, rawKeyword, rawPage, { select: "_id name description status" });

  return {
    recordList,
    pagination
  };
};

export const getRoleById = async (id: string) => {
  return Role.findOne({ _id: id, deleted: false });
};

export const updateRole = async (id: string, data: IRoleInput): Promise<{ success: boolean; message: string; role?: IRole }> => {
  const roleDetail = await Role.findOne({ _id: id, deleted: false });
  if (!roleDetail) {
    return { success: false, message: "Role does not exist!" };
  }

  if (typeof data.permissions === "string") {
    data.permissions = JSON.parse(data.permissions);
  }
  data.search = toSearchText(String(data.name || ""));

  await Role.updateOne({ _id: id, deleted: false }, data);
  invalidateAdminAuthCache();
  return { success: true, message: "Updated successfully!" };
};

export const softDeleteRole = async (id: string) => {
  await Role.updateOne({ _id: id }, { deleted: true, deletedAt: Date.now() });
  invalidateAdminAuthCache();
  return { success: true, message: "Role deleted successfully!" };
};

export const softDeleteManyRoles = (ids: string[]) => {
  invalidateAdminAuthCache();
  return softDeleteMany(Role, ids, "role");
};

export const restoreRole = async (id: string) => {
  await Role.updateOne({ _id: id }, { deleted: false });
  invalidateAdminAuthCache();
  return { success: true, message: "Restored successfully!" };
};

export const restoreManyRoles = (ids: string[]) => {
  invalidateAdminAuthCache();
  return restoreMany(Role, ids, "role");
};

export const permanentlyDeleteRole = async (id: string) => {
  await Role.deleteOne({ _id: id });
  invalidateAdminAuthCache();
  return { success: true, message: "Deleted permanently!" };
};

export const permanentlyDeleteManyRoles = (ids: string[]) => {
  invalidateAdminAuthCache();
  return permanentlyDeleteMany(Role, ids, "role");
};

export const getRoleTrash = () => getTrash(Role, "_id name description status deletedAt");
