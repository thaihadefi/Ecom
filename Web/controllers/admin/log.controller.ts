import { Request, Response } from 'express';
import AdminLog from '../../models/admin-log.model';
import AccountAdmin from '../../models/account-admin.model';
import { PAGINATION } from '../../configs/pagination.config';
import { getPagination } from '../../helpers/pagination.helper';
import { escapeRegex } from '../../helpers/generate.helper';

export const list = async (req: Request, res: Response) => {
  const find: any = {};

  if(req.query.keyword) {
    const keyword = `${req.query.keyword}`.trim();
    const keywordRegex = new RegExp(escapeRegex(keyword), "i");
    find.$or = [
      { title: keywordRegex },
      { route: keywordRegex }
    ];
  }

  // Pagination
  const limitItems = PAGINATION.ADMIN_LIMIT;
  const totalRecord = await AdminLog.countDocuments(find);
  const pagination = getPagination(req.query.page, limitItems, totalRecord);

  const recordList: any = await AdminLog
    .find(find)
    .select("adminId method route title createdAt")
    .sort({ createdAt: "desc" })
    .limit(limitItems)
    .skip(pagination.skip)

  const adminIds = [...new Set(recordList.filter((i: any) => i.adminId).map((i: any) => i.adminId))];
  if (adminIds.length > 0) {
    const admins = await AccountAdmin.find({ _id: { $in: adminIds } }).select("_id fullName email");
    const adminMap = new Map((admins as any[]).map((a: any) => [String(a._id), a]));
    for (const item of recordList) {
      const admin = item.adminId ? adminMap.get(String(item.adminId)) : null;
      if (admin) {
        item.adminName = (admin as any).fullName;
        item.adminEmail = (admin as any).email;
      }
    }
  }

  res.render("admin/pages/admin-log-list", {
    pageTitle: "Admin Activity Log",
    recordList: recordList,
    pagination: pagination
  });
}
