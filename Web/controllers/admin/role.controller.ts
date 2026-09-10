import { Request, Response } from 'express';
import { pathAdmin, permissionList } from '../../configs/variable.config';
import { logAdminAction } from '../../helpers/log.helper';
import * as roleService from '../../services/admin/role.service';

export const create = (_req: Request, res: Response) => {
  res.render("admin/pages/role-create", {
    pageTitle: "Create Role",
    permissionList: permissionList
  });
};

export const createPost = async (req: Request, res: Response) => {
  try {
    const newRecord = await roleService.createRole(req.body);
    logAdminAction(req, `Created role: ${req.body.name} (Id: ${newRecord.id})`);

    res.json({
      code: "success",
      message: "Role created successfully!"
    });
  } catch (error) {
    console.error("createPost role error:", error);
    res.json({
      code: "error",
      message: "Invalid data!"
    });
  }
};

export const list = async (req: Request, res: Response) => {
  const data = await roleService.getRoleList(req.query.keyword, req.query.page);

  res.render("admin/pages/role-list", {
    pageTitle: "Roles List",
    ...data
  });
};

export const edit = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const roleDetail = await roleService.getRoleById(id);

    if (!roleDetail) {
      res.redirect(`/${pathAdmin}/role/list`);
      return;
    }

    res.render("admin/pages/role-edit", {
      pageTitle: "Edit Role",
      roleDetail: roleDetail,
      permissionList: permissionList
    });
  } catch (error) {
    console.error("edit role error:", error);
    res.redirect(`/${pathAdmin}/role/list`);
  }
};

export const editPatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const result = await roleService.updateRole(id, req.body);

    if (!result.success) {
      res.json({
        code: "error",
        message: result.message
      });
      return;
    }

    logAdminAction(req, `Edited role: ${req.body.name} (Id: ${id})`);

    res.json({
      code: "success",
      message: result.message
    });
  } catch (error) {
    console.error("editPatch role error:", error);
    res.json({
      code: "error",
      message: "Invalid ID!"
    });
  }
};

export const deletePatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const result = await roleService.softDeleteRole(id);
    logAdminAction(req, `Deleted role: ${id}`);

    res.json({
      code: "success",
      message: result.message
    });
  } catch (error) {
    console.error("deletePatch role error:", error);
    res.json({
      code: "error",
      message: "Invalid ID!"
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
    const result = await roleService.permanentlyDeleteManyRoles(ids);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    console.error("destroyManyDelete role error:", error);
    res.json({ code: "error", message: "Invalid data!" });
  }
};

export const trash = async (_req: Request, res: Response) => {
  const recordList = await roleService.getRoleTrash();
  res.render("admin/pages/role-trash", { pageTitle: "Role Trash", recordList });
};

export const undoPatch = async (req: Request, res: Response) => {
  try {
    const result = await roleService.restoreRole(req.params.id);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    console.error("undoPatch role error:", error);
    res.json({ code: "error", message: "Invalid ID!" });
  }
};

export const destroyDelete = async (req: Request, res: Response) => {
  try {
    const result = await roleService.permanentlyDeleteRole(req.params.id);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    console.error("destroyDelete role error:", error);
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
    const result = await roleService.softDeleteManyRoles(ids);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    console.error("deleteManyPatch role error:", error);
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
    const result = await roleService.restoreManyRoles(ids);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    console.error("undoManyPatch role error:", error);
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
        const result = await roleService.restoreManyRoles(ids);
        res.json({ code: "success", message: result.message });
        break;
      }
      case "destroy": {
        const result = await roleService.permanentlyDeleteManyRoles(ids);
        res.json({ code: "success", message: result.message });
        break;
      }
      default:
        res.json({ code: "error", message: "Invalid action!" });
    }
  } catch (error) {
    console.error("changeMultiPatch role error:", error);
    res.json({ code: "error", message: "Invalid data!" });
  }
};
