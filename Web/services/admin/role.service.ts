import Role from '../../models/role.model';
import { IRole, IRoleInput } from '../../interfaces/models/role.interface';
import { toSearchText } from '../../helpers/slugify.helper';
import { escapeRegex } from '../../helpers/generate.helper';
import { PAGINATION } from '../../configs/pagination.config';
import { getPagination } from '../../helpers/pagination.helper';

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
  const totalRecord = await Role.countDocuments(find);
  const pagination = getPagination(rawPage, limitItems, totalRecord);

  const recordList = await Role
    .find(find)
    .select("_id name description status")
    .limit(limitItems)
    .skip(pagination.skip)
    .sort({ createdAt: "desc" });

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

export const softDeleteManyRoles = async (ids: string[]) => {
  await Role.updateMany({ _id: { $in: ids } }, { deleted: true, deletedAt: new Date() });
  return { success: true, message: `Moved ${ids.length} role(s) to trash!` };
};

export const restoreRole = async (id: string) => {
  await Role.updateOne({ _id: id }, { deleted: false });
  return { success: true, message: "Restored successfully!" };
};

export const restoreManyRoles = async (ids: string[]) => {
  await Role.updateMany({ _id: { $in: ids } }, { deleted: false });
  return { success: true, message: `Restored ${ids.length} role(s)!` };
};

export const permanentlyDeleteRole = async (id: string) => {
  await Role.deleteOne({ _id: id });
  return { success: true, message: "Deleted permanently!" };
};

export const permanentlyDeleteManyRoles = async (ids: string[]) => {
  await Role.deleteMany({ _id: { $in: ids } });
  return { success: true, message: `Deleted ${ids.length} role(s) permanently!` };
};

export const getRoleTrash = async () => {
  return Role.find({ deleted: true }).select("_id name description status deletedAt").sort({ deletedAt: "desc" });
};
