import { Request, Response } from 'express';
import * as logService from '../../services/admin/log.service';

export const list = async (req: Request, res: Response) => {
  const data = await logService.getAdminLogList(req.query.keyword, req.query.page);

  res.render("admin/pages/admin-log-list", {
    pageTitle: "Admin Activity Log",
    ...data
  });
};
