import mongoose from 'mongoose';
import AccountUser from '../../models/account-user.model';
import UserAddress from '../../models/user-address.model';
import ChatRoom from '../../models/chat-room.model';
import Review from '../../models/review.model';
import { toSearchText } from '../../helpers/slugify.helper';
import { escapeRegex } from '../../helpers/generate.helper';
import { PAGINATION } from '../../configs/pagination.config';
import { getPagination } from '../../helpers/pagination.helper';

export const getUserAccountList = async (rawKeyword?: unknown, rawPage?: unknown) => {
  const find: {
    deleted: boolean;
    search?: RegExp;
  } = {
    deleted: false
  };

  if (rawKeyword) {
    const keyword = toSearchText(`${rawKeyword}`);
    const keywordRegex = new RegExp(escapeRegex(keyword), "i");
    find.search = keywordRegex;
  }

  const limitItems = PAGINATION.ADMIN_LIMIT;
  const totalRecord = await AccountUser.countDocuments(find);
  const pagination = getPagination(rawPage, limitItems, totalRecord);

  const recordList = await AccountUser
    .find(find)
    .select("-password -search")
    .limit(limitItems)
    .skip(pagination.skip)
    .sort({ createdAt: "desc" });

  return {
    recordList,
    pagination
  };
};

export const softDeleteUserAccount = async (id: string) => {
  await AccountUser.updateOne({ _id: id }, { deleted: true, deletedAt: new Date() });
  return { success: true, message: "User deleted successfully!" };
};

export const softDeleteManyUserAccounts = async (ids: string[]) => {
  await AccountUser.updateMany({ _id: { $in: ids } }, { deleted: true, deletedAt: new Date() });
  return { success: true, message: `Moved ${ids.length} user(s) to trash!` };
};

export const restoreUserAccount = async (id: string) => {
  await AccountUser.updateOne({ _id: id }, { deleted: false });
  return { success: true, message: "Restored successfully!" };
};

export const restoreManyUserAccounts = async (ids: string[]) => {
  await AccountUser.updateMany({ _id: { $in: ids } }, { deleted: false });
  return { success: true, message: `Restored ${ids.length} user(s)!` };
};

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

export const getUserAccountTrash = async () => {
  return AccountUser.find({ deleted: true }).select("_id fullName email phone status deletedAt").sort({ deletedAt: "desc" });
};
