import Role from '../../models/role.model';
import { IRole, IRoleInput } from '../../interfaces/models/role.interface';
import { toSearchText } from '../../helpers/slugify.helper';
import { softDeleteMany, restoreMany, permanentlyDeleteMany, getTrash } from "../../helpers/admin-crud.helper";
import { paginatedSearch } from "../../helpers/list-query.helper";

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
  return { success: true, message: "Updated successfully!" };
};

export const softDeleteRole = async (id: string) => {
  await Role.updateOne({ _id: id }, { deleted: true, deletedAt: Date.now() });
  return { success: true, message: "Role deleted successfully!" };
};

export const softDeleteManyRoles = (ids: string[]) => softDeleteMany(Role, ids, "role");

export const restoreRole = async (id: string) => {
  await Role.updateOne({ _id: id }, { deleted: false });
  return { success: true, message: "Restored successfully!" };
};

export const restoreManyRoles = (ids: string[]) => restoreMany(Role, ids, "role");

export const permanentlyDeleteRole = async (id: string) => {
  await Role.deleteOne({ _id: id });
  return { success: true, message: "Deleted permanently!" };
};

export const permanentlyDeleteManyRoles = (ids: string[]) => permanentlyDeleteMany(Role, ids, "role");

export const getRoleTrash = () => getTrash(Role, "_id name description status deletedAt");
