import { Request } from "express";

export interface RequestAccount extends Request {
  adminId?: string;
  _auditLogged?: boolean;
}
