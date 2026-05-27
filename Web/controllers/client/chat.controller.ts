import { Request, Response } from 'express';
import ChatRoom from '../../models/chat-room.model';
import ChatMessage from '../../models/chat-message.model';
import { timeAgo } from '../../helpers/format.helper';
import FormData from 'form-data';
import axios from 'axios';
import { domainCDN } from '../../configs/variable.config';

export const messages = async (req: Request, res: Response) => {
  const userId = res.locals.accountUser.id;
  
  if(!userId) {
    res.json({
      code: "error",
      message: "Failed!"
    })
    return;
  }

  // Get chat room info
  const chatRoom = await ChatRoom.findOne({
    userId: userId
  });

  if(!chatRoom) {
    res.json({
      code: "error",
      message: "Failed!"
    })
    return;
  }

  // Messages list
  const { limit = 20, lastMessageId } = req.query;

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
      createdAt: "desc" // Newest first
    })
    .limit(parseInt(`${limit}`))

  for (const item of chatMessages) {
    item.createdAtFormat = timeAgo(item.createdAt);
  }
  
  res.json({
    code: "success",
    message: "Success!",
    messages: lastMessageId ? chatMessages : chatMessages.reverse(),
    adminUnreadCount: chatRoom.unreadCount?.admin ?? 0
  })
}

export const uploadPost = async (req: Request, res: Response) => {
  try {
    const userId = res.locals.accountUser.id;
    const files = req.files as Express.Multer.File[];

    if(!files || !files.length) {
      res.json({
        code: "error",
        message: "Please provide files!"
      })
      return;
    }

    const chatRoomDetail = await ChatRoom.findOne({
      userId: userId
    });

    if(chatRoomDetail?.status === "locked") {
      res.json({
        code: "error",
        message: "Chat room is locked!"
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
    formData.append('folderPath', `chats/${userId}`);

    const response = await axios.post(`${domainCDN}/file-manager/upload`, formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${process.env.FILE_MANAGER_SECRET}`
      } // Required for correct multipart/form-data sending
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

export const ratePost = async (req: Request, res: Response) => {
  try {
    const userId = res.locals.accountUser.id;
    const { stars, comment } = req.body;

    const chatRoom = await ChatRoom.findOne({
      userId: userId,
      status: "open"
    });

    if(!chatRoom) {
      res.json({
        code: "error",
        message: "Chat room not found!"
      })
      return;
    }

    await ChatRoom.updateOne({
      _id: chatRoom.id
    }, {
      $push: {
        rating: {
          stars: stars,
          comment: comment,
          ratedAt: new Date()
        }
      }
    });
    
    res.json({
      code: "success",
      message: "Thank you for your rating!"
    });
  } catch (error) {
    console.error(error);
    res.json({
      code: "error",
      message: "Invalid data!"
    })
  }
}