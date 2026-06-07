import { Request, Response } from 'express';
import ContactInquiry from '../../models/contact-inquiry.model';
import { PAGINATION } from '../../configs/pagination.config';
import { getPagination } from '../../helpers/pagination.helper';
import { escapeRegex } from '../../helpers/generate.helper';

export const list = async (req: Request, res: Response) => {
  // Migrate legacy records to have deleted: false if not set
  await ContactInquiry.updateMany(
    { deleted: { $exists: false } },
    { $set: { deleted: false } }
  );

  const find: any = {
    deleted: { $ne: true }
  };

  if(req.query.keyword) {
    const keyword = `${req.query.keyword}`.trim();
    const keywordRegex = new RegExp(escapeRegex(keyword), "i");
    find.$or = [
      { name: keywordRegex },
      { email: keywordRegex },
      { subject: keywordRegex }
    ];
  }

  // Pagination
  const limitItems = PAGINATION.ADMIN_LIMIT;
  const totalRecord = await ContactInquiry.countDocuments(find);
  const pagination = getPagination(req.query.page, limitItems, totalRecord);
  // End Pagination
  
  const recordList: any = await ContactInquiry
    .find(find)
    .select("_id name email subject message read createdAt")
    .limit(limitItems)
    .skip(pagination.skip)
    .sort({
      createdAt: "desc"
    });
  
  res.render("admin/pages/contact-inquiry-list", {
    pageTitle: "Manage Contact Inquiries",
    recordList: recordList,
    pagination: pagination
  });
}

export const deletePatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    await ContactInquiry.updateOne({ _id: id }, { deleted: true, deletedAt: Date.now() });
    res.json({ code: "success", message: "Inquiry moved to trash successfully!" });
  } catch (error) {
    res.json({ code: "error", message: "Invalid ID!" });
  }
}

export const changeStatusPatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const status = req.params.status; // status: "read" or "unread"
    const isRead = status === "read";

    await ContactInquiry.updateOne({
      _id: id,
      deleted: { $ne: true }
    }, {
      read: isRead
    });

    res.json({
      code: "success",
      message: "Read status updated successfully!"
    })
  } catch (error) {
    console.log(error);
    res.json({
      code: "error",
      message: "Invalid ID!"
    })
  }
}

export const deleteManyPatch = async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body.ids;
    if (!ids || !ids.length) {
      res.json({ code: "error", message: "No items selected!" });
      return;
    }
    await ContactInquiry.updateMany({ _id: { $in: ids } }, { deleted: true, deletedAt: new Date() });
    res.json({ code: "success", message: `Moved ${ids.length} inquiry(s) to trash!` });
  } catch (error) {
    res.json({ code: "error", message: "Invalid data!" });
  }
};

export const trash = async (req: Request, res: Response) => {
  const recordList: any = await ContactInquiry.find({ deleted: true }).select("_id name email subject status deletedAt").sort({ deletedAt: "desc" });
  res.render("admin/pages/contact-inquiry-trash", { pageTitle: "Contact Inquiry Trash", recordList });
};

export const undoPatch = async (req: Request, res: Response) => {
  try {
    await ContactInquiry.updateOne({ _id: req.params.id }, { deleted: false });
    res.json({ code: "success", message: "Inquiry restored successfully!" });
  } catch (error) {
    res.json({ code: "error", message: "Invalid ID!" });
  }
};

export const destroyDelete = async (req: Request, res: Response) => {
  try {
    await ContactInquiry.deleteOne({ _id: req.params.id });
    res.json({ code: "success", message: "Inquiry permanently deleted!" });
  } catch (error) {
    res.json({ code: "error", message: "Invalid ID!" });
  }
};

export const destroyManyDelete = async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body.ids;
    if (!ids || !ids.length) {
      res.json({ code: "error", message: "No items selected!" });
      return;
    }
    await ContactInquiry.deleteMany({ _id: { $in: ids } });
    res.json({ code: "success", message: `Deleted ${ids.length} inquiry(s) permanently!` });
  } catch (error) {
    res.json({ code: "error", message: "Invalid data!" });
  }
};

export const undoManyPatch = async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body.ids;
    if (!ids || !ids.length) {
      res.json({ code: "error", message: "No items selected!" });
      return;
    }
    await ContactInquiry.updateMany({ _id: { $in: ids } }, { deleted: false });
    res.json({ code: "success", message: `Restored ${ids.length} inquiry(s)!` });
  } catch (error) {
    res.json({ code: "error", message: "Invalid data!" });
  }
};

export const changeMultiPatch = async (req: Request, res: Response) => {
  try {
    const { value, ids } = req.body;
    if (!value || !ids || !ids.length) {
      res.json({ code: "error", message: "Invalid data!" });
      return;
    }
    switch (value) {
      case "undo":
        await ContactInquiry.updateMany({ _id: { $in: ids } }, { deleted: false });
        res.json({ code: "success", message: `Restored ${ids.length} inquiry(s)!` });
        break;
      case "destroy":
        await ContactInquiry.deleteMany({ _id: { $in: ids } });
        res.json({ code: "success", message: `Permanently deleted ${ids.length} inquiry(s)!` });
        break;
      default:
        res.json({ code: "error", message: "Invalid action!" });
    }
  } catch (error) {
    res.json({ code: "error", message: "Invalid data!" });
  }
};
