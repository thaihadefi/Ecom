import { RequestAccount } from "../interfaces/request.interface";
import AdminLog from "../models/admin-log.model";

export const logAdminAction = (req: RequestAccount, title: string): void => {
  req._auditLogged = true;
  new AdminLog({
    adminId: req.adminId,
    method: req.method,
    route: req.originalUrl,
    title,
    expireAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
  }).save().catch((error) => console.error("[AuditLog] Failed to write entry:", error));
}
