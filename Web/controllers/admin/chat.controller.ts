import { Request, Response } from 'express';
import { getChatRoomList, invalidateRoomList } from '../../helpers/chat.helper';
import ChatRoom from '../../models/chat-room.model';
import AccountUser from '../../models/account-user.model';
import ChatMessage from '../../models/chat-message.model';
import { timeAgo } from '../../helpers/format.helper';
import FormData from 'form-data';
import axios from 'axios';
import { domainCDN, pathAdmin } from '../../configs/variable.config';
import { aiGenerateAnswer } from '../../helpers/ai.helper';

export const myChatList = async (_req: Request, res: Response) => {
  // Chat room list
  const chatRoomList: any = await getChatRoomList(res.locals.accountAdmin.id);
  
  res.render("admin/pages/my-chat-list", {
    pageTitle: "Your Chat List",
    chatRoomList: chatRoomList
  });
}

export const detail = async (req: Request, res: Response) => {
  try {
    // Chat room details
    const id = req.params.id;
    const chatRoomDetail = await ChatRoom.findOne({
      _id: id
    });

    if(!chatRoomDetail) {
      res.redirect('/admin/dashboard');
      return;
    }

    // User information
    const infoUser = await AccountUser.findOne({
      _id: chatRoomDetail.userId
    }).select("_id fullName avatar");

    if(!infoUser) {
      res.redirect('/admin/dashboard');
      return;
    }

    // Reset unread + invalidate cache so sidebar reflects immediately
    await ChatRoom.updateOne({ _id: id }, { "unreadCount.admin": 0 });
    invalidateRoomList(res.locals.accountAdmin.id);

    // Chat room list (messages are loaded by JS, no need to SSR them)
    const chatRoomList: any = await getChatRoomList(res.locals.accountAdmin.id);

    res.render("admin/pages/chat-detail", {
      pageTitle: "Message Details",
      chatRoomList: chatRoomList,
      chatRoomDetail: chatRoomDetail,
      infoUser: infoUser,
    });
  } catch (error) {
    res.redirect('/admin/dashboard');
  }
}

export const messages = async (req: Request, res: Response) => {
  const adminId = res.locals.accountAdmin.id;
  const { limit = 20, roomId, lastMessageId } = req.query;

  if(!adminId) {
    res.json({
      code: "error",
      message: "Failed!"
    })
    return;
  }

  // Get chat room info
  const chatRoom = await ChatRoom.findOne({
    _id: roomId
  });

  if(!chatRoom) {
    res.json({
      code: "error",
      message: "Failed!"
    })
    return;
  }

  // Message list
  const find: any = {
    roomId: chatRoom?.id
  };

  if(lastMessageId) {
    find._id = {
      $lt: lastMessageId
    };
  }

  const chatMessages: any = await ChatMessage
    .find(find)
    .sort({
      createdAt: "desc" // newest first
    })
    .limit(parseInt(`${limit}`))

  for (const item of chatMessages) {
    item.createdAtFormat = timeAgo(item.createdAt);
  }
  
  res.json({
    code: "success",
    message: "Success!",
    messages: lastMessageId ? chatMessages : chatMessages.reverse(),
    userUnreadCount: chatRoom.unreadCount?.user ?? 0
  })
}

export const uploadPost = async (req: Request, res: Response) => {
  try {
    const roomId = req.body.roomId;
    const files = req.files as Express.Multer.File[];

    if(!files || !files.length) {
      res.json({
        code: "error",
        message: "Please attach a file!"
      })
      return;
    }

    const chatRoomDetail = await ChatRoom.findOne({
      _id: roomId
    });

    if(!chatRoomDetail) {
      res.json({
        code: "error",
        message: "Chat room not found!"
      })
      return;
    }

    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype
      });
    })
    formData.append('folderPath', `chats/${chatRoomDetail.userId}`);

    const response = await axios.post(`${domainCDN}/file-manager/upload`, formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${process.env.FILE_MANAGER_SECRET}`
      } // necessary to send correct multipart/form-data
    });

    if(response.data.code == "error") {
      res.json({
        code: "error",
        message: "Upload error!"
      })
      return;
    }
    
    const saveLinks = response.data.saveLinks;
    const fileUrls = saveLinks.map((item: any) => `${item.folder}/${item.filename}`);
    res.json({
      code: "success",
      message: "Uploaded successfully!",
      fileUrls: fileUrls
    });
  } catch (error) {
    console.error(error);
    res.json({
      code: "error",
      message: "Invalid data!"
    })
  }
}

export const changeStatusPatch = async (req: Request, res: Response) => {
  try {
    const { roomId, status } = req.body;

    const chatRoomDetail = await ChatRoom.findOne({
      _id: roomId
    });

    if(!chatRoomDetail) {
      res.json({
        code: "error",
        message: "Chat room not found!"
      })
      return;
    }

    await ChatRoom.updateOne({
      _id: roomId
    }, {
      status: status
    })
    
    res.json({
      code: "success",
      message: "Status changed successfully!"
    });
  } catch (error) {
    console.error(error);
    res.json({
      code: "error",
      message: "Invalid data!"
    })
  }
}

export const rate = async (req: Request, res: Response) => {
  try {    
    // Chat room details
    const id = req.params.id;
    const chatRoomDetail = await ChatRoom.findOne({
      _id: id
    });

    if(!chatRoomDetail) {
      res.redirect(`/${pathAdmin}/dashboard`);
      return;
    }

    const ratingList = chatRoomDetail.rating.reverse();

    // Chat room list
    const chatRoomList: any = await getChatRoomList(res.locals.accountAdmin.id);
    
    res.render("admin/pages/chat-rate", {
      pageTitle: "Message Details",
      chatRoomList: chatRoomList,
      chatRoomDetail: chatRoomDetail,
      ratingList: ratingList
    });
  } catch (error) {
    res.redirect('/admin/dashboard');
  }
}

export const suggestReply = async (req: Request, res: Response) => {
  try {
    const roomId = req.params.id;

    const messages = await ChatMessage.find({
      roomId: roomId
    })
    .sort({
      createdAt: "desc"
    })
    .limit(10)

    const string = messages
      .reverse()
      .map(item => {
        return `${item.senderRole === "user" ? "Customer" : "Admin"}: ${item.content}`;
      })
      .join("\n");

    const prompt = `
      You are a customer service assistant.

      Here is the conversation between the customer and the admin:

      ${string}

      Please suggest 3 short, polite responses for the admin to reply to the customer.
      Write in English.
    `;

    const content = await aiGenerateAnswer(prompt);

    res.json({
      code: "success",
      message: "Success!",
      content: content
    });
  } catch (error) {
    console.error(error);
    res.json({
      code: "error",
      message: "Invalid data!"
    })
  }
}

export const editReplyPost = async (req: Request, res: Response) => {
  try {
    const roomId = req.params.id;
    const { content: contentChat } = req.body;

    const messages = await ChatMessage.find({
      roomId: roomId
    })
    .sort({
      createdAt: "desc"
    })
    .limit(10)

    const string = messages
      .reverse()
      .map(item => {
        return `${item.senderRole === "user" ? "Customer" : "Admin"}: ${item.content}`;
      })
      .join("\n");

    const prompt = `
      You are a customer service assistant.

      Here is the conversation between the customer and the admin:

      ${string}

      Here is the reply the admin is drafting: ${contentChat}

      Please edit the admin's draft and suggest 3 better alternative responses.
      Write in English.
    `;

    const content = await aiGenerateAnswer(prompt);

    res.json({
      code: "success",
      message: "Success!",
      content: content
    });
  } catch (error) {
    console.error(error);
    res.json({
      code: "error",
      message: "Invalid data!"
    })
  }
}

export const summary = async (req: Request, res: Response) => {
  try {
    const roomId = req.params.id;

    const messages = await ChatMessage.find({
      roomId: roomId
    })
    .sort({
      createdAt: "desc"
    })
    .limit(10)

    const string = messages
      .reverse()
      .map(item => {
        return `${item.senderRole === "user" ? "Customer" : "Admin"}: ${item.content}`;
      })
      .join("\n");

    const prompt = `
      You are a customer service assistant.

      Here is the conversation between the customer and the admin:

      ${string}

      Please summarize the conversation between the customer and the admin to be very short and concise.
    `;

    const content = await aiGenerateAnswer(prompt);

    res.json({
      code: "success",
      message: "Success!",
      content: content
    });
  } catch (error) {
    console.error(error);
    res.json({
      code: "error",
      message: "Invalid data!"
    })
  }
}

export const customerEmotions = async (req: Request, res: Response) => {
  try {
    const roomId = req.params.id;

    const messages = await ChatMessage.find({
      roomId: roomId
    })
    .sort({
      createdAt: "desc"
    })
    .limit(20)

    const string = messages
      .reverse()
      .map(item => {
        return `${item.senderRole === "user" ? "Customer" : "Admin"}: ${item.content}`;
      })
      .join("\n");

    const prompt = `
      You are a customer service assistant.

      Here is the conversation between the customer and the admin:

      ${string}

      Please analyze the conversation between the customer and the admin in detail, then analyze the customer's emotions. Feedback on how the customer's emotions are currently, and whether this customer is potential or not.
    `;

    const content = await aiGenerateAnswer(prompt);

    res.json({
      code: "success",
      message: "Success!",
      content: content
    });
  } catch (error) {
    console.error(error);
    res.json({
      code: "error",
      message: "Invalid data!"
    })
  }
}