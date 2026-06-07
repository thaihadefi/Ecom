import { toSearchText } from '../../helpers/slugify.helper';
import { escapeRegex } from '../../helpers/generate.helper';
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import AccountUser from '../../models/account-user.model';
import UserAddress from '../../models/user-address.model';
import ChatRoom from '../../models/chat-room.model';
import Review from '../../models/review.model';
import { PAGINATION } from '../../configs/pagination.config';
import { getPagination } from '../../helpers/pagination.helper';

export const list = async (req: Request, res: Response) => {
  const find: {
    deleted: boolean,
    search?: RegExp
  } = {
    deleted: false
  };

  if(req.query.keyword) {
    const keyword = toSearchText(`${req.query.keyword}`)
    const keywordRegex = new RegExp(escapeRegex(keyword), "i");
    find.search = keywordRegex;
  }

  // Pagination
  const limitItems = PAGINATION.ADMIN_LIMIT;
  const totalRecord = await AccountUser.countDocuments(find);
  const pagination = getPagination(req.query.page, limitItems, totalRecord);
  // End Pagination

  const recordList: any = await AccountUser
    .find(find)
    .select("-password -search")
    .limit(limitItems)
    .skip(pagination.skip)
    .sort({
      createdAt: "desc"
    });

  res.render("admin/pages/account-user-list", {
    pageTitle: "User Accounts List",
    recordList: recordList,
    pagination: pagination
  });
}
export const destroyManyDelete = async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body.ids;
    if (!ids || !ids.length) {
      res.json({ code: "error", message: "No items selected!" });
      return;
    }
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
    res.json({ code: "success", message: `Deleted ${ids.length} user account(s) permanently!` });
  } catch (error) {
    res.json({ code: "error", message: "Invalid data!" });
  }
};

export const deletePatch = async (req: Request, res: Response) => {
  try {
    await AccountUser.updateOne({ _id: req.params.id }, { deleted: true, deletedAt: new Date() });
    res.json({ code: "success", message: "User deleted successfully!" });
  } catch (error) {
    res.json({ code: "error", message: "Invalid ID!" });
  }
};

export const trash = async (req: Request, res: Response) => {
  const recordList: any = await AccountUser.find({ deleted: true }).select("_id fullName email phone status deletedAt").sort({ deletedAt: "desc" });
  res.render("admin/pages/account-user-trash", { pageTitle: "User Account Trash", recordList });
};

export const undoPatch = async (req: Request, res: Response) => {
  try {
    await AccountUser.updateOne({ _id: req.params.id }, { deleted: false });
    res.json({ code: "success", message: "Restored successfully!" });
  } catch (error) {
    res.json({ code: "error", message: "Invalid ID!" });
  }
};

export const destroyDelete = async (req: Request, res: Response) => {
  try {
    const userId = String(req.params.id);
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
    res.json({ code: "success", message: "Deleted permanently!" });
  } catch (error) {
    res.json({ code: "error", message: "Invalid ID!" });
  }
};

export const deleteManyPatch = async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body.ids;
    if (!ids || !ids.length) { res.json({ code: "error", message: "No items selected!" }); return; }
    await AccountUser.updateMany({ _id: { $in: ids } }, { deleted: true, deletedAt: new Date() });
    res.json({ code: "success", message: `Moved ${ids.length} user(s) to trash!` });
  } catch (error) {
    res.json({ code: "error", message: "Invalid data!" });
  }
};

export const undoManyPatch = async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body.ids;
    if (!ids || !ids.length) { res.json({ code: "error", message: "No items selected!" }); return; }
    await AccountUser.updateMany({ _id: { $in: ids } }, { deleted: false });
    res.json({ code: "success", message: `Restored ${ids.length} user(s)!` });
  } catch (error) {
    res.json({ code: "error", message: "Invalid data!" });
  }
};

export const changeMultiPatch = async (req: Request, res: Response) => {
  try {
    const { value, ids } = req.body;
    if (!value || !ids || !ids.length) { res.json({ code: "error", message: "Invalid data!" }); return; }
    switch (value) {
      case "undo":
        await AccountUser.updateMany({ _id: { $in: ids } }, { deleted: false });
        res.json({ code: "success", message: `Restored ${ids.length} user(s)!` });
        break;
      case "destroy": {
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
        res.json({ code: "success", message: `Permanently deleted ${ids.length} user(s)!` });
        break;
      }
      default:
        res.json({ code: "error", message: "Invalid action!" });
    }
  } catch (error) {
    res.json({ code: "error", message: "Invalid data!" });
  }
};
