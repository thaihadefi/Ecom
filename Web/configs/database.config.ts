import dns from "dns";
import mongoose from "mongoose";

dns.setServers(["1.1.1.1", "8.8.8.8"]);

export const connectDB = async () => {
  mongoose.set("bufferCommands", false);
  await mongoose.connect(`${process.env.DATABASE}`, {
    maxPoolSize: 50,
    minPoolSize: 10,
    maxIdleTimeMS: 60000,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });
  console.log("Database connection successful!");
}
