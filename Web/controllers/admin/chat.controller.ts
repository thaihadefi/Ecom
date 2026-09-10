import { Request, Response } from 'express';
import { pathAdmin } from '../../configs/variable.config';
import * as chatService from '../../services/admin/chat.service';

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
    const data = await chatService.getAdminChatDetail(id, res.locals.accountAdmin.id);

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
  const { limit = 20, roomId, lastMessageId } = req.query;

  if (!adminId) {
    res.json({
      code: "error",
      message: "Failed!"
    });
    return;
  }

  const data = await chatService.getAdminMessages(
    roomId as string,
    parseInt(`${limit}`),
    lastMessageId
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
    messages: data.messages,
    userUnreadCount: data.userUnreadCount
  });
};

export const uploadPost = async (req: Request, res: Response) => {
  try {
    const roomId = req.body.roomId;
    const files = req.files as Express.Multer.File[];

    if (!files || !files.length) {
      res.json({
        code: "error",
        message: "Please attach a file!"
      });
      return;
    }

    const result = await chatService.uploadAdminChatFiles(roomId, files);

    if (!result.success) {
      res.json({
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
    res.json({
      code: "error",
      message: "Invalid data!"
    });
  }
};

export const changeStatusPatch = async (req: Request, res: Response) => {
  try {
    const { roomId, status } = req.body;
    const result = await chatService.changeChatRoomStatus(roomId, status);

    res.json({
      code: result.success ? "success" : "error",
      message: result.message
    });
  } catch (error) {
    console.error("changeStatusPatch admin chat error:", error);
    res.json({
      code: "error",
      message: "Invalid data!"
    });
  }
};

export const rate = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const data = await chatService.getAdminChatRating(id, res.locals.accountAdmin.id);

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
    const content = await chatService.suggestAdminReply(roomId);

    res.json({
      code: "success",
      message: "Success!",
      content: content
    });
  } catch (error) {
    console.error("suggestReply error:", error);
    res.json({
      code: "error",
      message: "Invalid data!"
    });
  }
};

export const editReplyPost = async (req: Request, res: Response) => {
  try {
    const roomId = req.params.id;
    const { content: contentChat } = req.body;
    const content = await chatService.editAdminReply(roomId, contentChat);

    res.json({
      code: "success",
      message: "Success!",
      content: content
    });
  } catch (error) {
    console.error("editReplyPost error:", error);
    res.json({
      code: "error",
      message: "Invalid data!"
    });
  }
};

export const summary = async (req: Request, res: Response) => {
  try {
    const roomId = req.params.id;
    const content = await chatService.summarizeAdminChat(roomId);

    res.json({
      code: "success",
      message: "Success!",
      content: content
    });
  } catch (error) {
    console.error("summary error:", error);
    res.json({
      code: "error",
      message: "Invalid data!"
    });
  }
};

export const customerEmotions = async (req: Request, res: Response) => {
  try {
    const roomId = req.params.id;
    const content = await chatService.analyzeAdminChatEmotions(roomId);

    res.json({
      code: "success",
      message: "Success!",
      content: content
    });
  } catch (error) {
    console.error("customerEmotions error:", error);
    res.json({
      code: "error",
      message: "Invalid data!"
    });
  }
};
