import { toSearchText } from '../../helpers/slugify.helper';
import { escapeRegex } from '../../helpers/generate.helper';
import { Request, Response } from 'express';
import Role from '../../models/role.model';
import bcrypt from "bcryptjs";
import AccountAdmin from '../../models/account-admin.model';
import { pathAdmin } from '../../configs/variable.config';
import { PAGINATION } from '../../configs/pagination.config';
import { getPagination } from '../../helpers/pagination.helper';
import { logAdminAction } from '../../helpers/log.helper';

// Returns true if the actor may assign ALL the given roles.
// Non-superadmin can only assign roles whose permissions are a strict subset of their own — prevents privilege escalation.
const canActorGrantRoles = async (actorIsSuperAdmin: boolean, actorPermissions: string[], roleIds: string[]): Promise<boolean> => {
  if (actorIsSuperAdmin) return true;
  const roles = await Role.find({ _id: { $in: roleIds }, deleted: false, status: "active" }).select("_id permissions");
  if (roles.length !== roleIds.length) return false;
  return (roles as any[]).every(role =>
    (role.permissions as string[]).every((p: string) => actorPermissions.includes(p))
  );
};

export const create = async (_req: Request, res: Response) => {
  const roleList = await Role.find({
    deleted: false,
    status: "active"
  }).select("_id name");

  res.render("admin/pages/account-admin-create", {
    pageTitle: "Create Admin Account",
    roleList: roleList
  });
}

export const createPost = async (req: Request, res: Response) => {
  try {
    const existAccount = await AccountAdmin.findOne({
      email: req.body.email,
      deleted: false
    }).select("_id")

    if(existAccount) {
      res.json({
        code: "error",
        message: "Email already exists!"
      })
      return;
    }

    req.body.roles = JSON.parse(req.body.roles);

    if (!await canActorGrantRoles(res.locals.accountAdmin?.isSuperAdmin, res.locals.permissions || [], req.body.roles)) {
      res.json({ code: "error", message: "You cannot assign a role with permissions you do not hold." });
      return;
    }

    req.body.search = toSearchText(`${req.body.fullName} ${req.body.email}`);

    // Encrypt password
    req.body.password = await bcrypt.hash(req.body.password, 10);

    req.body.isSuperAdmin = false; // Never allow creating superadmin via API

    const newRecord = new AccountAdmin(req.body);
    await newRecord.save();

    logAdminAction(req, `Created admin account: ${req.body.fullName} (${req.body.email})`);

    res.json({
      code: "success",
      message: "Account created successfully!"
    })
  } catch (error) {
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
  const totalRecord = await AccountAdmin.countDocuments(find);
  const pagination = getPagination(req.query.page, limitItems, totalRecord);
  // End Pagination

  const recordList: any = await AccountAdmin
    .find(find)
    .select("-password -search")
    .limit(limitItems)
    .skip(pagination.skip)
    .sort({
      createdAt: "desc"
    });

  const allRoleIds = [...new Set(recordList.flatMap((item: any) => item.roles || []))];
  const allRoles = allRoleIds.length > 0
    ? await Role.find({ _id: { $in: allRoleIds } }).select("_id name")
    : [];
  const roleMap = new Map((allRoles as any[]).map((r: any) => [String(r._id), r.name]));
  for (const item of recordList) {
    item.rolesName = (item.roles || []).map((id: string) => roleMap.get(String(id))).filter(Boolean);
  }

  res.render("admin/pages/account-admin-list", {
    pageTitle: "Admin Account List",
    recordList: recordList,
    pagination: pagination
  });
}

export const edit = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    const accountDetail = await AccountAdmin.findOne({
      _id: id,
      deleted: false
    })

    if(!accountDetail) {
      res.redirect(`/${pathAdmin}/account-admin/list`);
      return;
    }

    const roleList = await Role.find({
      deleted: false,
      status: "active"
    }).select("_id name")

    res.render("admin/pages/account-admin-edit", {
      pageTitle: "Edit Admin Account",
      roleList: roleList,
      accountDetail: accountDetail
    });
  } catch (error) {
    res.redirect(`/${pathAdmin}/account-admin/list`);
  }
}

export const editPatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    const accountDetail = await AccountAdmin.findOne({ _id: id, deleted: false });

    if (!accountDetail) {
      res.json({ code: "error", message: "Account does not exist!" });
      return;
    }

    if (accountDetail.isSuperAdmin && res.locals.accountAdmin?.id !== id) {
      res.json({ code: "error", message: "Cannot modify a superadmin account." });
      return;
    }

    // Prevent self-deactivation
    if (res.locals.accountAdmin?.id === id && req.body.status && req.body.status !== "active") {
      res.json({ code: "error", message: "Cannot deactivate your own account." });
      return;
    }

    const existEmail = await AccountAdmin.findOne({
      email: req.body.email,
      deleted: false,
      _id: { $ne: id } // not equal
    }).select("_id")

    if(existEmail) {
      res.json({
        code: "error",
        message: "Email already in use by another account!"
      })
      return;
    }

    req.body.roles = JSON.parse(req.body.roles);

    if (!await canActorGrantRoles(res.locals.accountAdmin?.isSuperAdmin, res.locals.permissions || [], req.body.roles)) {
      res.json({ code: "error", message: "You cannot assign a role with permissions you do not hold." });
      return;
    }

    req.body.search = toSearchText(`${req.body.fullName} ${req.body.email}`);

    await AccountAdmin.updateOne({
      _id: id,
      deleted: false
    }, req.body);

    res.json({
      code: "success",
      message: "Updated successfully!"
    })
  } catch (error) {
    res.json({
      code: "error",
      message: "Invalid data!"
    })
  }
}

export const deletePatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    const target = await AccountAdmin.findOne({ _id: id, deleted: false }).select("isSuperAdmin");
    if (target?.isSuperAdmin) {
      res.json({ code: "error", message: "Cannot delete a superadmin account." });
      return;
    }

    await AccountAdmin.updateOne({ _id: id }, { deleted: true, deletedAt: Date.now() });

    res.json({
      code: "success",
      message: "Account deleted successfully!"
    })
  } catch (error) {
    console.log(error);
    res.json({
      code: "error",
      message: "Invalid ID!"
    })
  }
}

export const changePassword = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    res.redirect(`/${pathAdmin}/account-admin/edit/${id}#change-password`);
  } catch (error) {
    res.redirect(`/${pathAdmin}/account-admin/list`);
  }
}

export const changePasswordPatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    const accountDetail = await AccountAdmin.findOne({ _id: id, deleted: false });

    if (!accountDetail) {
      res.json({ code: "error", message: "Account does not exist!" });
      return;
    }

    if (accountDetail.isSuperAdmin && res.locals.accountAdmin?.id !== id) {
      res.json({ code: "error", message: "Cannot change password of a superadmin account." });
      return;
    }

    // Encrypt password
    req.body.password = await bcrypt.hash(req.body.password, 10);

    await AccountAdmin.updateOne({
      _id: id,
      deleted: false
    }, req.body);

    res.json({
      code: "success",
      message: "Password changed successfully!"
    })
  } catch (error) {
    res.json({
      code: "error",
      message: "Invalid data!"
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
    await AccountAdmin.deleteMany({ _id: { $in: ids } });
    res.json({ code: "success", message: `Deleted ${ids.length} admin account(s) permanently!` });
  } catch (error) {
    res.json({ code: "error", message: "Invalid data!" });
  }
};

export const trash = async (req: Request, res: Response) => {
  const recordList: any = await AccountAdmin.find({ deleted: true }).select("_id fullName email status deletedAt").sort({ deletedAt: "desc" });
  res.render("admin/pages/account-admin-trash", { pageTitle: "Admin Account Trash", recordList });
};

export const undoPatch = async (req: Request, res: Response) => {
  try {
    await AccountAdmin.updateOne({ _id: req.params.id }, { deleted: false });
    res.json({ code: "success", message: "Restored successfully!" });
  } catch (error) {
    res.json({ code: "error", message: "Invalid ID!" });
  }
};

export const destroyDelete = async (req: Request, res: Response) => {
  try {
    await AccountAdmin.deleteOne({ _id: req.params.id });
    res.json({ code: "success", message: "Deleted permanently!" });
  } catch (error) {
    res.json({ code: "error", message: "Invalid ID!" });
  }
};

export const deleteManyPatch = async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body.ids;
    if (!ids || !ids.length) { res.json({ code: "error", message: "No items selected!" }); return; }
    await AccountAdmin.updateMany({ _id: { $in: ids } }, { deleted: true, deletedAt: new Date() });
    res.json({ code: "success", message: `Moved ${ids.length} account(s) to trash!` });
  } catch (error) {
    res.json({ code: "error", message: "Invalid data!" });
  }
};

export const undoManyPatch = async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body.ids;
    if (!ids || !ids.length) { res.json({ code: "error", message: "No items selected!" }); return; }
    await AccountAdmin.updateMany({ _id: { $in: ids } }, { deleted: false });
    res.json({ code: "success", message: `Restored ${ids.length} account(s)!` });
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
        await AccountAdmin.updateMany({ _id: { $in: ids } }, { deleted: false });
        res.json({ code: "success", message: `Restored ${ids.length} account(s)!` });
        break;
      case "destroy":
        await AccountAdmin.deleteMany({ _id: { $in: ids } });
        res.json({ code: "success", message: `Permanently deleted ${ids.length} account(s)!` });
        break;
      default:
        res.json({ code: "error", message: "Invalid action!" });
    }
  } catch (error) {
    res.json({ code: "error", message: "Invalid data!" });
  }
};
