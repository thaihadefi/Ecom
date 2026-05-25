import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    roomId: String, // Room ID
    senderId: String, // Message sender ID
    senderRole: { // Sender role
      type: String,
      enum: ["user", "admin"],
    },
    content: String, // Message content
    files: [String], // Array of files
  },
  {
    timestamps: true,
  }
);

// Auto-delete messages after 30 days via MongoDB TTL index
schema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

const ChatMessage = mongoose.model('ChatMessage', schema, "chat-messages");

export default ChatMessage;