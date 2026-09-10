import { NextFunction, Request, Response } from "express";
import * as chatService from "../../services/client/chat.service";

export const getChatMessageTotal = async (_req: Request, res: Response, next: NextFunction) => {
  if (res.locals.accountUser?.id) {
    res.locals.chatMessageTotal = await chatService.getUserUnreadCount(res.locals.accountUser.id);
  }
  next();
};
