import { Request, Response } from 'express';
import * as chatService from '../../services/client/chat.service';

export const messages = async (req: Request, res: Response) => {
  const userId = res.locals.accountUser?.id;

  if (!userId) {
    res.json({
      code: "error",
      message: "Failed!"
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
    res.json({
      code: "error",
      message: "Failed!"
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
      res.json({
        code: "error",
        message: "Please provide files!"
      });
      return;
    }

    const result = await chatService.uploadChatFiles(userId, files);

    if (!result.success) {
      res.json({
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
    res.json({
      code: "error",
      message: "Invalid data!"
    });
  }
};

export const ratePost = async (req: Request, res: Response) => {
  try {
    const userId = res.locals.accountUser?.id;
    const { stars, comment } = req.body;

    const result = await chatService.rateChatRoom(userId, stars, comment);

    if (!result.success) {
      res.json({
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
    res.json({
      code: "error",
      message: "Invalid data!"
    });
  }
};
