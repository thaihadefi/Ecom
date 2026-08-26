import { Request, Response } from 'express';
import * as contactInquiryService from '../../services/admin/contact-inquiry.service';

export const list = async (req: Request, res: Response) => {
  const data = await contactInquiryService.getContactInquiryList(req.query.keyword, req.query.page);

  res.render("admin/pages/contact-inquiry-list", {
    pageTitle: "Manage Contact Inquiries",
    ...data
  });
};

export const deletePatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const result = await contactInquiryService.softDeleteContactInquiry(id);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    console.error("deletePatch inquiry error:", error);
    res.json({ code: "error", message: "Invalid ID!" });
  }
};

export const changeStatusPatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const status = req.params.status;
    const isRead = status === "read";

    const result = await contactInquiryService.changeContactInquiryReadStatus(id, isRead);

    res.json({
      code: "success",
      message: result.message
    });
  } catch (error) {
    console.error("changeStatusPatch inquiry error:", error);
    res.json({
      code: "error",
      message: "Invalid ID!"
    });
  }
};

export const deleteManyPatch = async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body.ids;
    if (!ids || !ids.length) {
      res.json({ code: "error", message: "No items selected!" });
      return;
    }
    const result = await contactInquiryService.softDeleteManyContactInquiries(ids);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    console.error("deleteManyPatch inquiry error:", error);
    res.json({ code: "error", message: "Invalid data!" });
  }
};

export const trash = async (_req: Request, res: Response) => {
  const recordList = await contactInquiryService.getContactInquiryTrash();
  res.render("admin/pages/contact-inquiry-trash", { pageTitle: "Contact Inquiry Trash", recordList });
};

export const undoPatch = async (req: Request, res: Response) => {
  try {
    const result = await contactInquiryService.restoreContactInquiry(req.params.id);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    console.error("undoPatch inquiry error:", error);
    res.json({ code: "error", message: "Invalid ID!" });
  }
};

export const destroyDelete = async (req: Request, res: Response) => {
  try {
    const result = await contactInquiryService.permanentlyDeleteContactInquiry(req.params.id);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    console.error("destroyDelete inquiry error:", error);
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
    const result = await contactInquiryService.permanentlyDeleteManyContactInquiries(ids);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    console.error("destroyManyDelete inquiry error:", error);
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
    const result = await contactInquiryService.restoreManyContactInquiries(ids);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    console.error("undoManyPatch inquiry error:", error);
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
      case "undo": {
        const result = await contactInquiryService.restoreManyContactInquiries(ids);
        res.json({ code: "success", message: result.message });
        break;
      }
      case "destroy": {
        const result = await contactInquiryService.permanentlyDeleteManyContactInquiries(ids);
        res.json({ code: "success", message: result.message });
        break;
      }
      default:
        res.json({ code: "error", message: "Invalid action!" });
    }
  } catch (error) {
    console.error("changeMultiPatch inquiry error:", error);
    res.json({ code: "error", message: "Invalid data!" });
  }
};
