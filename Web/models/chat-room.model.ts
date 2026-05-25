import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    userId: { type: String, unique: true, sparse: true }, // one room per user
    adminId: String, // Admin ID
    unreadCount: { // Unread messages count
      user: {
        type: Number,
        default: 0
      },
      admin: {
        type: Number,
        default: 0
      }
    },
    status: { // Chat room status
      type: String,
      enum: ["open", "locked"], 
    },
    rating: [ // Chat rating
      {
        stars: { // Stars count
          type: Number,
          min: 1,
          max: 5
        },
        comment: String, // Notes
        ratedAt: Date // Rating date/time
      }
    ]
  },
  {
    timestamps: true, // Automatically generate createdAt and updatedAt fields
  }
);

schema.index({ adminId: 1 });
schema.index({ status: 1 });
schema.index({ adminId: 1, status: 1 });

const ChatRoom = mongoose.model('ChatRoom', schema, "chat-rooms");

export default ChatRoom;