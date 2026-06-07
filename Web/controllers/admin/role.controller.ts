import { toSearchText } from '../../helpers/slugify.helper';
import { escapeRegex } from '../../helpers/generate.helper';
import { Request, Response } from 'express';
import { pathAdmin, permissionList } from '../../configs/variable.config';
import Role from '../../models/role.model';
import { PAGINATION } from '../../configs/pagination.config';
import { getPagination } from '../../helpers/pagination.helper';
import { logAdminAction } from '../../helpers/log.helper';

export const create = (req: Request, res: Response) => {
  res.render("admin/pages/role-create", {
    pageTitle: "Create Role",
    permissionList: permissionList
  });
}

export const createPost = async (req: Request, res: Response) => {
  try {
    req.body.permissions = JSON.parse(req.body.permissions);

    req.body.search = toSearchText(`${req.body.name}`);

    const newRecord = new Role(req.body);
    await newRecord.save();

    logAdminAction(req, `Created role: ${req.body.name} (Id: ${newRecord.id})`);

    res.json({
      code: "success",
      message: "Role created successfully!"
    })
  } catch (error) {
    console.log(error);
    res.json({
      code: "error",
      message: "Invalid data!"
    })
  }
}

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
  const totalRecord = await Role.countDocuments(find);
  const pagination = getPagination(req.query.page, limitItems, totalRecord);
  // End Pagination

  const recordList: any = await Role
    .find(find)
    .select("_id name description status")
    .limit(limitItems)
    .skip(pagination.skip)
    .sort({
      createdAt: "desc"
    });

  res.render("admin/pages/role-list", {
    pageTitle: "Roles List",
    recordList: recordList,
    pagination: pagination
  });
}

export const edit = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    const roleDetail = await Role.findOne({
      _id: id,
      deleted: false
    })

    if(!roleDetail) {
      res.redirect(`/${pathAdmin}/role/list`);
      return;
    }

    res.render("admin/pages/role-edit", {
      pageTitle: "Edit Role",
      roleDetail: roleDetail,
      permissionList: permissionList
    });
  } catch (error) {
    console.log(error);
    res.redirect(`/${pathAdmin}/role/list`);
  }
}

export const editPatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    const roleDetail = await Role.findOne({
      _id: id,
      deleted: false
    })

    if(!roleDetail) {
      res.json({
        code: "error",
        message: "Role does not exist!"
      })
      return;
    }

    req.body.permissions = JSON.parse(req.body.permissions);

    req.body.search = toSearchText(req.body.name)

    await Role.updateOne({
      _id: id,
      deleted: false
    }, req.body);

    logAdminAction(req, `Edited role: ${req.body.name} (Id: ${id})`);

    res.json({
      code: "success",
      message: "Updated successfully!"
    })
  } catch (error) {
    console.log(error);
    res.json({
      code: "error",
      message: "Invalid ID!"
    })
  }
}

export const deletePatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    await Role.updateOne({
      _id: id
    }, {
      deleted: true,
      deletedAt: Date.now(),
    });

    logAdminAction(req, `Deleted role: ${id}`);

    res.json({
      code: "success",
      message: "Role deleted successfully!"
    })
  } catch (error) {
    console.log(error);
    res.json({
      code: "error",
      message: "Invalid ID!"
    })
  }
}
export const destroyManyDelete = async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body.ids;
    if (!ids || !ids.length) {
      res.json({ code: "error", message: "No items selected!" });
      return;
    }
    await Role.deleteMany({ _id: { $in: ids } });
    res.json({ code: "success", message: `Deleted ${ids.length} role(s) permanently!` });
  } catch (error) {
    res.json({ code: "error", message: "Invalid data!" });
  }
};

export const trash = async (req: Request, res: Response) => {
  const recordList: any = await Role.find({ deleted: true }).select("_id name description status deletedAt").sort({ deletedAt: "desc" });
  res.render("admin/pages/role-trash", { pageTitle: "Role Trash", recordList });
};

export const undoPatch = async (req: Request, res: Response) => {
  try {
    await Role.updateOne({ _id: req.params.id }, { deleted: false });
    res.json({ code: "success", message: "Restored successfully!" });
  } catch (error) {
    res.json({ code: "error", message: "Invalid ID!" });
  }
};

export const destroyDelete = async (req: Request, res: Response) => {
  try {
    await Role.deleteOne({ _id: req.params.id });
    res.json({ code: "success", message: "Deleted permanently!" });
  } catch (error) {
    res.json({ code: "error", message: "Invalid ID!" });
  }
};

export const deleteManyPatch = async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body.ids;
    if (!ids || !ids.length) { res.json({ code: "error", message: "No items selected!" }); return; }
    await Role.updateMany({ _id: { $in: ids } }, { deleted: true, deletedAt: new Date() });
    res.json({ code: "success", message: `Moved ${ids.length} role(s) to trash!` });
  } catch (error) {
    res.json({ code: "error", message: "Invalid data!" });
  }
};

export const undoManyPatch = async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body.ids;
    if (!ids || !ids.length) { res.json({ code: "error", message: "No items selected!" }); return; }
    await Role.updateMany({ _id: { $in: ids } }, { deleted: false });
    res.json({ code: "success", message: `Restored ${ids.length} role(s)!` });
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
        await Role.updateMany({ _id: { $in: ids } }, { deleted: false });
        res.json({ code: "success", message: `Restored ${ids.length} role(s)!` });
        break;
      case "destroy":
        await Role.deleteMany({ _id: { $in: ids } });
        res.json({ code: "success", message: `Permanently deleted ${ids.length} role(s)!` });
        break;
      default:
        res.json({ code: "error", message: "Invalid action!" });
    }
  } catch (error) {
    res.json({ code: "error", message: "Invalid data!" });
  }
};
