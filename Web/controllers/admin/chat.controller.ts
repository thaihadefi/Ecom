import { Request, Response } from 'express';
import { pathAdmin } from '../../configs/variable.config';
import * as chatService from '../../services/admin/chat.service';
import { resultStatus, sendCaughtError } from "../../helpers/http-response.helper";

export const myChatList = async (_req: Request, res: Response) => {
  const chatRoomList = await chatService.getAdminChatList(res.locals.accountAdmin.id);

  res.render("admin/pages/my-chat-list", {
    pageTitle: "Your Chat List",
    chatRoomList: chatRoomList
  });
};

export const detail = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const data = await chatService.getAdminChatDetail(id, res.locals.accountAdmin);

    if (!data) {
      res.redirect('/admin/dashboard');
      return;
    }

    res.render("admin/pages/chat-detail", {
      pageTitle: "Message Details",
      chatRoomList: data.chatRoomList,
      chatRoomDetail: data.chatRoomDetail,
      infoUser: data.infoUser,
    });
  } catch (error) {
    console.error("detail chat admin error:", error);
    res.redirect('/admin/dashboard');
  }
};

export const messages = async (req: Request, res: Response) => {
  const adminId = res.locals.accountAdmin?.id;
  const { limit = 20, lastMessageId } = req.query;
  const roomId = req.params.roomId;

  if (!adminId) {
    res.status(401).json({
      code: "error",
      message: "Please log in!"
    });
    return;
  }

  const data = await chatService.getAdminMessages(
    String(roomId),
    res.locals.accountAdmin,
    parseInt(`${limit}`),
    lastMessageId
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
    messages: data.messages,
    userUnreadCount: data.userUnreadCount
  });
};

export const uploadPost = async (req: Request, res: Response) => {
  try {
    const roomId = req.params.roomId;
    const files = req.files as Express.Multer.File[];

    if (!files || !files.length) {
      res.status(400).json({
        code: "error",
        message: "Please attach a file!"
      });
      return;
    }

    const result = await chatService.uploadAdminChatFiles(String(roomId), res.locals.accountAdmin, files);

    if (!result.success) {
      res.status(resultStatus(result)).json({
        code: "error",
        message: result.message
      });
      return;
    }

    res.json({
      code: "success",
      message: result.message,
      fileUrls: result.fileUrls
    });
  } catch (error) {
    console.error("uploadPost admin chat error:", error);
    sendCaughtError(res, error, "Invalid data!");
  }
};

export const changeStatusPatch = async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const { status } = req.body;
    const result = await chatService.changeChatRoomStatus(String(roomId), res.locals.accountAdmin, String(status));

    res.status(resultStatus(result)).json({
      code: result.success ? "success" : "error",
      message: result.message
    });
  } catch (error) {
    console.error("changeStatusPatch admin chat error:", error);
    sendCaughtError(res, error, "Invalid data!");
  }
};

export const rate = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const data = await chatService.getAdminChatRating(id, res.locals.accountAdmin);

    if (!data) {
      res.redirect(`/${pathAdmin}/dashboard`);
      return;
    }

    res.render("admin/pages/chat-rate", {
      pageTitle: "Message Details",
      chatRoomList: data.chatRoomList,
      chatRoomDetail: data.chatRoomDetail,
      ratingList: data.ratingList
    });
  } catch (error) {
    console.error("rate admin chat error:", error);
    res.redirect('/admin/dashboard');
  }
};

export const suggestReply = async (req: Request, res: Response) => {
  try {
    const roomId = req.params.id;
    const content = await chatService.suggestAdminReply(roomId, res.locals.accountAdmin);

    res.json({
      code: "success",
      message: "Success!",
      content: content
    });
  } catch (error) {
    console.error("suggestReply error:", error);
    sendCaughtError(res, error, "Invalid data!");
  }
};

export const editReplyPost = async (req: Request, res: Response) => {
  try {
    const roomId = req.params.id;
    const { content: contentChat } = req.body;
    const content = await chatService.editAdminReply(roomId, res.locals.accountAdmin, contentChat);

    res.json({
      code: "success",
      message: "Success!",
      content: content
    });
  } catch (error) {
    console.error("editReplyPost error:", error);
    sendCaughtError(res, error, "Invalid data!");
  }
};

export const summary = async (req: Request, res: Response) => {
  try {
    const roomId = req.params.id;
    const content = await chatService.summarizeAdminChat(roomId, res.locals.accountAdmin);

    res.json({
      code: "success",
      message: "Success!",
      content: content
    });
  } catch (error) {
    console.error("summary error:", error);
    sendCaughtError(res, error, "Invalid data!");
  }
};

export const customerEmotions = async (req: Request, res: Response) => {
  try {
    const roomId = req.params.id;
    const content = await chatService.analyzeAdminChatEmotions(roomId, res.locals.accountAdmin);

    res.json({
      code: "success",
      message: "Success!",
      content: content
    });
  } catch (error) {
    console.error("customerEmotions error:", error);
    sendCaughtError(res, error, "Invalid data!");
  }
};
