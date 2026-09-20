import { Request, Response } from 'express';
import { pathAdmin } from '../../configs/variable.config';
import { logAdminAction } from '../../helpers/log.helper';
import { COOKIE_OPTS } from '../../configs/cookie.config';
import { signAccessToken, ACCESS_TOKEN_TTL_MS } from '../../helpers/token-rotation.helper';
import { accessTokenBody } from '../../helpers/access-token.helper';
import * as accountAdminService from '../../services/admin/account-admin.service';
import { resultStatus, sendCaughtError } from "../../helpers/http-response.helper";

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
      res.status(resultStatus(result)).json({
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
    sendCaughtError(res, error, "Invalid data!");
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

    res.status(resultStatus(result)).json({
      code: result.success ? "success" : "error",
      message: result.message
    });
  } catch (error) {
    console.error("editPatch admin error:", error);
    sendCaughtError(res, error, "Invalid data!");
  }
};

export const deletePatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const result = await accountAdminService.softDeleteAdminAccount(id);

    res.status(resultStatus(result)).json({
      code: result.success ? "success" : "error",
      message: result.message
    });
  } catch (error) {
    console.error("deletePatch admin error:", error);
    sendCaughtError(res, error, "Invalid ID!");
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

    let renewedToken: string | undefined;
    if (result.success && id === res.locals.accountAdmin?.id) {
      renewedToken = signAccessToken({ id, email: res.locals.accountAdmin.email });
      res.cookie("tokenAdmin", renewedToken, {
        ...COOKIE_OPTS,
        maxAge: ACCESS_TOKEN_TTL_MS,
      });
    }

    res.status(resultStatus(result)).json({
      code: result.success ? "success" : "error",
      message: result.message,
      ...(renewedToken ? accessTokenBody(renewedToken) : {})
    });
  } catch (error) {
    console.error("changePasswordPatch admin error:", error);
    sendCaughtError(res, error, "Invalid data!");
  }
};

export const destroyManyDelete = async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body.ids;
    if (!ids || !ids.length) {
      res.status(400).json({ code: "error", message: "No items selected!" });
      return;
    }
    const result = await accountAdminService.permanentlyDeleteManyAdminAccounts(ids);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    console.error("destroyManyDelete admin error:", error);
    sendCaughtError(res, error, "Invalid data!");
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
    sendCaughtError(res, error, "Invalid ID!");
  }
};

export const destroyDelete = async (req: Request, res: Response) => {
  try {
    const result = await accountAdminService.permanentlyDeleteAdminAccount(req.params.id);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    console.error("destroyDelete admin error:", error);
    sendCaughtError(res, error, "Invalid ID!");
  }
};

export const deleteManyPatch = async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body.ids;
    if (!ids || !ids.length) {
      res.status(400).json({ code: "error", message: "No items selected!" });
      return;
    }
    const result = await accountAdminService.softDeleteManyAdminAccounts(ids);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    console.error("deleteManyPatch admin error:", error);
    sendCaughtError(res, error, "Invalid data!");
  }
};

export const undoManyPatch = async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body.ids;
    if (!ids || !ids.length) {
      res.status(400).json({ code: "error", message: "No items selected!" });
      return;
    }
    const result = await accountAdminService.restoreManyAdminAccounts(ids);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    console.error("undoManyPatch admin error:", error);
    sendCaughtError(res, error, "Invalid data!");
  }
};
