import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    userId: { type: String, unique: true, sparse: true },
    adminId: String,
    unreadCount: {
      user: {
        type: Number,
        default: 0
      },
      admin: {
        type: Number,
        default: 0
      }
    },
    status: {
      type: String,
      enum: ["open", "locked"],
    },
    rating: [
      {
        stars: {
          type: Number,
          min: 1,
          max: 5
        },
        comment: String,
        ratedAt: Date
      }
    ]
  },
  {
    timestamps: true,
  }
);

schema.index({ adminId: 1 });
schema.index({ status: 1 });
schema.index({ adminId: 1, status: 1 });

import { IChatRoom } from '../interfaces/models/chat-room.interface';

const ChatRoom = mongoose.model<IChatRoom>('ChatRoom', schema, "chat-rooms");

export default ChatRoom;
