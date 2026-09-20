import { Request, Response } from 'express';
import * as chatService from '../../services/client/chat.service';
import { resultStatus, sendCaughtError } from "../../helpers/http-response.helper";

export const session = (_req: Request, res: Response) => {
  res.json({ ok: !!res.locals.accountUser });
};

export const messages = async (req: Request, res: Response) => {
  const userId = res.locals.accountUser?.id;

  if (!userId) {
    res.status(401).json({
      code: "error",
      message: "Please log in!"
    });
    return;
  }

  const { limit = 20, lastMessageId } = req.query;

  const data = await chatService.getMessagesByUserId(
    userId,
    limit,
    lastMessageId ? String(lastMessageId) : undefined
  );

  if (!data) {
    res.status(404).json({
      code: "error",
      message: "Chat room not found!"
    });
    return;
  }

  res.json({
    code: "success",
    message: "Success!",
    ...data
  });
};

export const uploadPost = async (req: Request, res: Response) => {
  try {
    const userId = res.locals.accountUser?.id;
    const files = req.files as Express.Multer.File[];

    if (!files || !files.length) {
      res.status(400).json({
        code: "error",
        message: "Please provide files!"
      });
      return;
    }

    const result = await chatService.uploadChatFiles(userId, files);

    if (!result.success) {
      res.status(resultStatus(result)).json({
        code: "error",
        message: result.message
      });
      return;
    }

    res.json({
      code: "success",
      message: "Uploaded successfully!",
      fileUrls: result.fileUrls
    });
  } catch (error) {
    console.error("chat upload error:", error);
    sendCaughtError(res, error, "Invalid data!");
  }
};

export const ratePost = async (req: Request, res: Response) => {
  try {
    const userId = res.locals.accountUser?.id;
    const { stars, comment } = req.body;

    const result = await chatService.rateChatRoom(userId, stars, comment);

    if (!result.success) {
      res.status(resultStatus(result)).json({
        code: "error",
        message: result.message
      });
      return;
    }

    res.json({
      code: "success",
      message: result.message
    });
  } catch (error) {
    console.error("chat rate error:", error);
    sendCaughtError(res, error, "Invalid data!");
  }
};
