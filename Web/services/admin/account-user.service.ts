import mongoose from 'mongoose';
import AccountUser from '../../models/account-user.model';
import UserAddress from '../../models/user-address.model';
import ChatRoom from '../../models/chat-room.model';
import Review from '../../models/review.model';
import { softDeleteMany, restoreMany, getTrash } from "../../helpers/admin-crud.helper";
import { paginatedSearch } from "../../helpers/list-query.helper";
import { invalidateUserAuthCache } from "../client/auth.service";
import { invalidateUserDashboardCache } from "../client/dashboard.service";
import { invalidateProductCaches } from "../../helpers/metadata-cache.helper";
import { invalidateAdminDashboardCaches } from "./dashboard.service";
import { invalidateRoomList, invalidateUserRoom, invalidateUnread, invalidateRoomStatus } from "../../helpers/chat-cache.helper";

export const getUserAccountList = async (rawKeyword?: unknown, rawPage?: unknown) => {
  const { recordList, pagination } = await paginatedSearch(AccountUser, rawKeyword, rawPage, { select: "-password -search" });

  return {
    recordList,
    pagination
  };
};

export const softDeleteUserAccount = async (id: string) => {
  await AccountUser.updateOne({ _id: id }, { deleted: true, deletedAt: new Date() });
  invalidateUserAuthCache(id);
  invalidateUserDashboardCache(id);
  invalidateAdminDashboardCaches();
  return { success: true, message: "User deleted successfully!" };
};

export const softDeleteManyUserAccounts = (ids: string[]) => {
  ids.forEach((id) => {
    invalidateUserAuthCache(id);
    invalidateUserDashboardCache(id);
  });
  invalidateAdminDashboardCaches();
  return softDeleteMany(AccountUser, ids, "user");
};

export const restoreUserAccount = async (id: string) => {
  await AccountUser.updateOne({ _id: id }, { deleted: false });
  invalidateUserAuthCache(id);
  invalidateUserDashboardCache(id);
  invalidateAdminDashboardCaches();
  return { success: true, message: "Restored successfully!" };
};

export const restoreManyUserAccounts = (ids: string[]) => {
  ids.forEach((id) => {
    invalidateUserAuthCache(id);
    invalidateUserDashboardCache(id);
  });
  invalidateAdminDashboardCaches();
  return restoreMany(AccountUser, ids, "user");
};

export const permanentlyDeleteUserAccount = async (id: string) => {
  const userId = String(id);
  const rooms = await ChatRoom.find({ userId }).select("_id adminId userId");

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await Promise.all([
        AccountUser.deleteOne({ _id: userId }, { session }),
        UserAddress.deleteMany({ userId }, { session }),
        ChatRoom.deleteMany({ userId }, { session }),
        Review.deleteMany({ userId }, { session }),
      ]);
    });
  } finally {
    session.endSession();
  }

  rooms.forEach((room) => {
    if (room.adminId) invalidateRoomList(room.adminId);
    if (room.userId) invalidateUserRoom(room.userId);
    invalidateUnread(room._id.toString(), room.userId);
    invalidateRoomStatus(room._id.toString());
  });

  invalidateUserAuthCache(userId);
  invalidateUserDashboardCache(userId);
  invalidateProductCaches();
  invalidateAdminDashboardCaches();
  return { success: true, message: "Deleted permanently!" };
};

export const permanentlyDeleteManyUserAccounts = async (ids: string[]) => {
  const userIds = ids.map(String);
  const rooms = await ChatRoom.find({ userId: { $in: userIds } }).select("_id adminId userId");

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await Promise.all([
        AccountUser.deleteMany({ _id: { $in: ids } }, { session }),
        UserAddress.deleteMany({ userId: { $in: userIds } }, { session }),
        ChatRoom.deleteMany({ userId: { $in: userIds } }, { session }),
        Review.deleteMany({ userId: { $in: userIds } }, { session }),
      ]);
    });
  } finally {
    session.endSession();
  }

  rooms.forEach((room) => {
    if (room.adminId) invalidateRoomList(room.adminId);
    if (room.userId) invalidateUserRoom(room.userId);
    invalidateUnread(room._id.toString(), room.userId);
    invalidateRoomStatus(room._id.toString());
  });

  ids.forEach((id) => {
    invalidateUserAuthCache(id);
    invalidateUserDashboardCache(id);
  });
  invalidateProductCaches();
  invalidateAdminDashboardCaches();
  return { success: true, message: `Deleted ${ids.length} user account(s) permanently!` };
};

export const getUserAccountTrash = () => getTrash(AccountUser, "_id fullName email phone status deletedAt");
