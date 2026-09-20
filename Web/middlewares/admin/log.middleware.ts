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
        // /admin/api/<resource>[/<id>][/<action>]: the record id says nothing useful in a title.
        const urlParts = req.originalUrl.split("?")[0].split("/").filter(Boolean).filter((part, index) => !(index < 2 && (part === "admin" || part === "api")));
        const moduleName = urlParts[0] || "system";
        const action = urlParts.slice(1).filter((part) => !/^[0-9a-f]{24}$/i.test(part)).join("/");
        title = `${req.method} /${moduleName}${action ? `/${action}` : ""}`;
      }
      logAdminAction(req, title);
    }
  });

  next();
};
