import { Request, Response } from 'express';
import { pathAdmin } from '../../configs/variable.config';
import { logAdminAction } from '../../helpers/log.helper';
import * as accountAdminService from '../../services/admin/account-admin.service';

export const create = async (_req: Request, res: Response) => {
  const roleList = await accountAdminService.getRolesForSelect();

  res.render("admin/pages/account-admin-create", {
    pageTitle: "Create Admin Account",
    roleList: roleList
  });
};

export const createPost = async (req: Request, res: Response) => {
  try {
    const result = await accountAdminService.createAdminAccount(
      req.body,
      res.locals.accountAdmin?.isSuperAdmin,
      res.locals.permissions || []
    );

    if (!result.success) {
      res.json({
        code: "error",
        message: result.message
      });
      return;
    }

    logAdminAction(req, `Created admin account: ${req.body.fullName} (${req.body.email})`);

    res.json({
      code: "success",
      message: result.message
    });
  } catch (error) {
    console.error("createPost admin error:", error);
    res.json({
      code: "error",
      message: "Invalid data!"
    });
  }
};

export const list = async (req: Request, res: Response) => {
  const data = await accountAdminService.getAdminAccountList(req.query.keyword, req.query.page);

  res.render("admin/pages/account-admin-list", {
    pageTitle: "Admin Account List",
    ...data
  });
};

export const edit = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const accountDetail = await accountAdminService.getAdminAccountById(id);

    if (!accountDetail) {
      res.redirect(`/${pathAdmin}/account-admin/list`);
      return;
    }

    const roleList = await accountAdminService.getRolesForSelect();

    res.render("admin/pages/account-admin-edit", {
      pageTitle: "Edit Admin Account",
      roleList: roleList,
      accountDetail: accountDetail
    });
  } catch (error) {
    console.error("edit admin error:", error);
    res.redirect(`/${pathAdmin}/account-admin/list`);
  }
};

export const editPatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const result = await accountAdminService.updateAdminAccount(
      id,
      req.body,
      res.locals.accountAdmin?.id,
      res.locals.accountAdmin?.isSuperAdmin,
      res.locals.permissions || []
    );

    res.json({
      code: result.success ? "success" : "error",
      message: result.message
    });
  } catch (error) {
    console.error("editPatch admin error:", error);
    res.json({
      code: "error",
      message: "Invalid data!"
    });
  }
};

export const deletePatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const result = await accountAdminService.softDeleteAdminAccount(id);

    res.json({
      code: result.success ? "success" : "error",
      message: result.message
    });
  } catch (error) {
    console.error("deletePatch admin error:", error);
    res.json({
      code: "error",
      message: "Invalid ID!"
    });
  }
};

export const changePassword = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    res.redirect(`/${pathAdmin}/account-admin/edit/${id}#change-password`);
  } catch (error) {
    res.redirect(`/${pathAdmin}/account-admin/list`);
  }
};

export const changePasswordPatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const result = await accountAdminService.changeAdminPassword(
      id,
      req.body.password,
      res.locals.accountAdmin?.id
    );

    res.json({
      code: result.success ? "success" : "error",
      message: result.message
    });
  } catch (error) {
    console.error("changePasswordPatch admin error:", error);
    res.json({
      code: "error",
      message: "Invalid data!"
    });
  }
};

export const destroyManyDelete = async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body.ids;
    if (!ids || !ids.length) {
      res.json({ code: "error", message: "No items selected!" });
      return;
    }
    const result = await accountAdminService.permanentlyDeleteManyAdminAccounts(ids);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    console.error("destroyManyDelete admin error:", error);
    res.json({ code: "error", message: "Invalid data!" });
  }
};

export const trash = async (_req: Request, res: Response) => {
  const recordList = await accountAdminService.getAdminAccountTrash();
  res.render("admin/pages/account-admin-trash", { pageTitle: "Admin Account Trash", recordList });
};

export const undoPatch = async (req: Request, res: Response) => {
  try {
    const result = await accountAdminService.restoreAdminAccount(req.params.id);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    console.error("undoPatch admin error:", error);
    res.json({ code: "error", message: "Invalid ID!" });
  }
};

export const destroyDelete = async (req: Request, res: Response) => {
  try {
    const result = await accountAdminService.permanentlyDeleteAdminAccount(req.params.id);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    console.error("destroyDelete admin error:", error);
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
    const result = await accountAdminService.softDeleteManyAdminAccounts(ids);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    console.error("deleteManyPatch admin error:", error);
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
    const result = await accountAdminService.restoreManyAdminAccounts(ids);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    console.error("undoManyPatch admin error:", error);
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
        const result = await accountAdminService.restoreManyAdminAccounts(ids);
        res.json({ code: "success", message: result.message });
        break;
      }
      case "destroy": {
        const result = await accountAdminService.permanentlyDeleteManyAdminAccounts(ids);
        res.json({ code: "success", message: result.message });
        break;
      }
      default:
        res.json({ code: "error", message: "Invalid action!" });
    }
  } catch (error) {
    console.error("changeMultiPatch admin error:", error);
    res.json({ code: "error", message: "Invalid data!" });
  }
};
