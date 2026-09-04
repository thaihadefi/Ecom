import mongoose from 'mongoose';
import AccountUser from '../../models/account-user.model';
import UserAddress from '../../models/user-address.model';
import ChatRoom from '../../models/chat-room.model';
import Review from '../../models/review.model';
import { softDeleteMany, restoreMany, getTrash } from "../../helpers/admin-crud.helper";
import { paginatedSearch } from "../../helpers/list-query.helper";

export const getUserAccountList = async (rawKeyword?: unknown, rawPage?: unknown) => {
  const { recordList, pagination } = await paginatedSearch(AccountUser, rawKeyword, rawPage, { select: "-password -search" });

  return {
    recordList,
    pagination
  };
};

export const softDeleteUserAccount = async (id: string) => {
  await AccountUser.updateOne({ _id: id }, { deleted: true, deletedAt: new Date() });
  return { success: true, message: "User deleted successfully!" };
};

export const softDeleteManyUserAccounts = (ids: string[]) => softDeleteMany(AccountUser, ids, "user");

export const restoreUserAccount = async (id: string) => {
  await AccountUser.updateOne({ _id: id }, { deleted: false });
  return { success: true, message: "Restored successfully!" };
};

export const restoreManyUserAccounts = (ids: string[]) => restoreMany(AccountUser, ids, "user");

export const permanentlyDeleteUserAccount = async (id: string) => {
  const userId = String(id);
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

  return { success: true, message: "Deleted permanently!" };
};

export const permanentlyDeleteManyUserAccounts = async (ids: string[]) => {
  const userIds = ids.map(String);
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

  return { success: true, message: `Deleted ${ids.length} user account(s) permanently!` };
};

export const getUserAccountTrash = () => getTrash(AccountUser, "_id fullName email phone status deletedAt");
