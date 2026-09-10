import { Response, NextFunction } from "express";
import { RequestAccount } from "../../interfaces/request.interface";
import { logAdminAction } from "../../helpers/log.helper";

export const autoAuditLog = (req: RequestAccount, res: Response, next: NextFunction) => {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    return next();
  }

  res.on("finish", () => {
    if (res.statusCode < 400 && !req._auditLogged && req.adminId) {
      let title = res.locals.auditTitle;
      if (!title) {
        const urlParts = req.originalUrl.split("?")[0].split("/").filter(Boolean);
        const action = urlParts[urlParts.length - 1] || "action";
        const moduleName = urlParts[1] || "system";
        title = `${req.method} /${moduleName}/${action}`;
      }
      logAdminAction(req, title);
    }
  });

  next();
};
