import mongoose from "mongoose";
import { IChatMessage } from '../interfaces/models/chat-message.interface';

const schema = new mongoose.Schema(
  {
    roomId: String,
    senderId: String,
    senderRole: {
      type: String,
      enum: ["user", "admin"],
      default: "user"
    },
    content: String,
    files: [String],
  },
  {
    timestamps: true,
  }
);

schema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

const ChatMessage = mongoose.model<IChatMessage>('ChatMessage', schema, "chat-messages");

export default ChatMessage;
