import { Request, Response } from 'express';
import * as accountUserService from '../../services/admin/account-user.service';

export const list = async (req: Request, res: Response) => {
  const data = await accountUserService.getUserAccountList(req.query.keyword, req.query.page);

  res.render("admin/pages/account-user-list", {
    pageTitle: "User Accounts List",
    ...data
  });
};

export const destroyManyDelete = async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body.ids;
    if (!ids || !ids.length) {
      res.json({ code: "error", message: "No items selected!" });
      return;
    }
    const result = await accountUserService.permanentlyDeleteManyUserAccounts(ids);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    console.error("destroyManyDelete user error:", error);
    res.json({ code: "error", message: "Invalid data!" });
  }
};

export const deletePatch = async (req: Request, res: Response) => {
  try {
    const result = await accountUserService.softDeleteUserAccount(req.params.id);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    console.error("deletePatch user error:", error);
    res.json({ code: "error", message: "Invalid ID!" });
  }
};

export const trash = async (_req: Request, res: Response) => {
  const recordList = await accountUserService.getUserAccountTrash();
  res.render("admin/pages/account-user-trash", { pageTitle: "User Account Trash", recordList });
};

export const undoPatch = async (req: Request, res: Response) => {
  try {
    const result = await accountUserService.restoreUserAccount(req.params.id);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    console.error("undoPatch user error:", error);
    res.json({ code: "error", message: "Invalid ID!" });
  }
};

export const destroyDelete = async (req: Request, res: Response) => {
  try {
    const result = await accountUserService.permanentlyDeleteUserAccount(req.params.id);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    console.error("destroyDelete user error:", error);
    res.json({ code: "error", message: "Invalid ID!" });
  }
};

export const deleteManyPatch = async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body.ids;
    if (!ids || !ids.length) {
      res.json({ code: "error", message: "No items selected!" });
      return;
    }
    const result = await accountUserService.softDeleteManyUserAccounts(ids);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    console.error("deleteManyPatch user error:", error);
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
    const result = await accountUserService.restoreManyUserAccounts(ids);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    console.error("undoManyPatch user error:", error);
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
        const result = await accountUserService.restoreManyUserAccounts(ids);
        res.json({ code: "success", message: result.message });
        break;
      }
      case "destroy": {
        const result = await accountUserService.permanentlyDeleteManyUserAccounts(ids);
        res.json({ code: "success", message: result.message });
        break;
      }
      default:
        res.json({ code: "error", message: "Invalid action!" });
    }
  } catch (error) {
    console.error("changeMultiPatch user error:", error);
    res.json({ code: "error", message: "Invalid data!" });
  }
};
