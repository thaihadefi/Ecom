import AdminLog from '../../models/admin-log.model';
import AccountAdmin from '../../models/account-admin.model';
import { PAGINATION } from '../../configs/pagination.config';
import { getPagination } from '../../helpers/pagination.helper';
import { escapeRegex } from '../../helpers/generate.helper';
import { IAccountAdmin } from '../../interfaces/models/account-admin.interface';

export const getAdminLogList = async (rawKeyword?: unknown, rawPage?: unknown) => {
  const find: Record<string, unknown> = {};

  if (rawKeyword) {
    const keyword = `${rawKeyword}`.trim();
    const keywordRegex = new RegExp(escapeRegex(keyword), "i");
    find.$or = [
      { title: keywordRegex },
      { route: keywordRegex }
    ];
  }

  const limitItems = PAGINATION.ADMIN_LIMIT;
  const totalRecord = await AdminLog.countDocuments(find);
  const pagination = getPagination(rawPage, limitItems, totalRecord);

  const recordList = await AdminLog
    .find(find)
    .select("adminId method route title createdAt")
    .sort({ createdAt: "desc" })
    .limit(limitItems)
    .skip(pagination.skip);

  const adminIds = [...new Set(recordList.map((i) => String(i.adminId)).filter((id): id is string => Boolean(id) && id !== "undefined"))];
  if (adminIds.length > 0) {
    const admins = await AccountAdmin.find({ _id: { $in: adminIds } }).select("_id fullName email");
    const adminMap = new Map((admins as IAccountAdmin[]).map((a) => [String(a._id), a]));
    for (const item of recordList) {
      const admin = adminMap.get(String(item.adminId));
      if (admin) {
        item.adminName = admin.fullName;
        item.adminEmail = admin.email;
      }
    }
  }

  return {
    recordList,
    pagination
  };
};
