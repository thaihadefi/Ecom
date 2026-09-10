import { Request, Response } from "express";
import { pathAdmin } from "../../configs/variable.config";
import * as templateService from "../../services/admin/template.service";

export const list = async (req: Request, res: Response) => {
  const data = await templateService.getTemplateList(req.query.keyword, req.query.page);

  res.render("admin/pages/template-list", {
    pageTitle: "Manage Templates",
    ...data
  });
};

export const create = async (_req: Request, res: Response) => {
  const blockList = await templateService.getActiveBlocksForTemplate();

  res.render("admin/pages/template-create", {
    pageTitle: "Create Template",
    blockList: blockList
  });
};

export const createPost = async (req: Request, res: Response) => {
  try {
    await templateService.createTemplate(req.body);

    res.json({
      code: "success",
      message: "Template created successfully!"
    });
  } catch (error) {
    console.error("createPost template error:", error);
    res.json({
      code: "error",
      message: "Invalid data!"
    });
  }
};

export const edit = async (req: Request, res: Response) => {
  try {
    const data = await templateService.getTemplateDetailForEdit(req.params.id);

    if (!data) {
      res.redirect(`/${pathAdmin}/template/list`);
      return;
    }

    res.render("admin/pages/template-edit", {
      pageTitle: "Edit Template",
      templateDetail: data.templateDetail,
      blockList: data.blockList
    });
  } catch (error) {
    console.error("edit template error:", error);
    res.redirect(`/${pathAdmin}/template/list`);
  }
};

export const editPatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const result = await templateService.updateTemplate(id, req.body);

    res.json({
      code: result.success ? "success" : "error",
      message: result.message
    });
  } catch (error) {
    console.error("editPatch template error:", error);
    res.json({
      code: "error",
      message: "Invalid data!"
    });
  }
};

export const deletePatch = async (req: Request, res: Response) => {
  try {
    const result = await templateService.deleteTemplate(req.params.id);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    console.error("deletePatch template error:", error);
    res.json({ code: "error", message: "Invalid ID!" });
  }
};
