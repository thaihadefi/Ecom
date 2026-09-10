import { Request, Response } from "express";
import { pathAdmin } from "../../configs/variable.config";
import * as blockService from "../../services/admin/block.service";

export const list = async (req: Request, res: Response) => {
  const data = await blockService.getBlockList(req.query.keyword, req.query.page);

  res.render("admin/pages/block-list", {
    pageTitle: "Manage Blocks",
    ...data
  });
};

export const create = async (_req: Request, res: Response) => {
  const fileList = blockService.getBlockTemplateFiles();

  res.render("admin/pages/block-create", {
    pageTitle: "Create Block",
    fileList: fileList
  });
};

export const createPost = async (req: Request, res: Response) => {
  try {
    await blockService.createBlock(req.body);

    res.json({
      code: "success",
      message: "Block created successfully!"
    });
  } catch (error) {
    console.error("createPost block error:", error);
    res.json({
      code: "error",
      message: "Invalid data!"
    });
  }
};

export const edit = async (req: Request, res: Response) => {
  try {
    const fileList = blockService.getBlockTemplateFiles();
    const blockDetail = await blockService.getBlockById(req.params.id);

    if (!blockDetail) {
      res.redirect(`/${pathAdmin}/block/list`);
      return;
    }

    res.render("admin/pages/block-edit", {
      pageTitle: "Edit Block",
      fileList: fileList,
      blockDetail: blockDetail
    });
  } catch (error) {
    console.error("edit block error:", error);
    res.redirect(`/${pathAdmin}/block/list`);
  }
};

export const editPatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const result = await blockService.updateBlock(id, req.body);

    res.json({
      code: result.success ? "success" : "error",
      message: result.message
    });
  } catch (error) {
    console.error("editPatch block error:", error);
    res.json({
      code: "error",
      message: "Invalid data!"
    });
  }
};

export const deletePatch = async (req: Request, res: Response) => {
  try {
    const result = await blockService.deleteBlock(req.params.id);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    console.error("deletePatch block error:", error);
    res.json({ code: "error", message: "Invalid ID!" });
  }
};
