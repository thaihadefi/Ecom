import { toSearchText } from '../../helpers/slugify.helper';
import { Request, Response } from "express";
import Block from "../../models/block.model";
import Template from "../../models/template.model";
import { pathAdmin } from "../../configs/variable.config";
import { escapeRegex } from '../../helpers/generate.helper';
import { PAGINATION } from '../../configs/pagination.config';
import { getPagination } from '../../helpers/pagination.helper';

export const list = async (req: Request, res: Response) => {
  const find: {
    deleted: boolean,
    search?: RegExp
  } = {
    deleted: false
  };

  if(req.query.keyword) {
    const keyword = toSearchText(`${req.query.keyword}`);
    const keywordRegex = new RegExp(escapeRegex(keyword), "i");
    find.search = keywordRegex;
  }

  // Pagination
  const limitItems = PAGINATION.ADMIN_LIMIT;
  const totalRecord = await Template.countDocuments(find);
  const pagination = getPagination(req.query.page, limitItems, totalRecord);
  // End Pagination

  const recordList = await Template.find(find)
    .select("_id name slug status blocks")
    .limit(limitItems)
    .skip(pagination.skip)
    .sort({ name: "asc" });

  res.render("admin/pages/template-list", {
    pageTitle: "Manage Templates",
    recordList: recordList,
    pagination: pagination
  });
}

export const create = async (req: Request, res: Response) => {
  const blockList = await Block
    .find({ deleted: false, status: "active" })
    .select("_id name fileName slug status")
    .sort({ name: "asc" })

  res.render("admin/pages/template-create", {
    pageTitle: "Create Template",
    blockList: blockList
  });
}
export const createPost = async (req: Request, res: Response) => {
  try {
    req.body.search = toSearchText(`${req.body.name} ${req.body.slug}`)

    const newRecord = new Template(req.body);
    await newRecord.save();

    res.json({
      code: "success",
      message: "Template created successfully!"
    });
  } catch (error) {
    console.log(error);
    res.json({
      code: "error",
      message: "Invalid data!"
    })
  }
}

export const edit = async (req: Request, res: Response) => {
  try {    
    const templateDetail: any = await Template.findOne({
      _id: req.params.id,
      deleted: false
    });

    if(!templateDetail) {
      res.redirect(`/${pathAdmin}/template/list`);
      return;
    }

    const blockIds = templateDetail.blocks.map((b: any) => b.blockId);
    const [blockDetails, blockList] = await Promise.all([
      Block.find({ _id: { $in: blockIds }, deleted: false }).select("_id name fileName"),
      Block.find({ deleted: false, status: "active" }).select("_id name fileName slug status").sort({ name: "asc" })
    ]);
    const blockDetailMap = new Map((blockDetails as any[]).map((b: any) => [String(b._id), b]));

    const missingBlockIds: string[] = [];
    for (const block of templateDetail.blocks) {
      const blockDetail = blockDetailMap.get(String(block.blockId));
      if (!blockDetail) {
        missingBlockIds.push(block.blockId);
      } else {
        block.name = blockDetail.name;
        block.fileName = blockDetail.fileName;
      }
    }
    if (missingBlockIds.length > 0) {
      await Template.updateOne(
        { _id: req.params.id, deleted: false },
        { $pull: { blocks: { blockId: { $in: missingBlockIds } } } }
      );
    }

    res.render("admin/pages/template-edit", {
      pageTitle: "Edit Template",
      templateDetail: templateDetail,
      blockList: blockList
    });
  } catch (error) {
    console.log(error);
    res.redirect(`/${pathAdmin}/template/list`);
  }
}

export const editPatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    const templateDetail: any = await Template.findOne({
      _id: req.params.id,
      deleted: false
    });

    if(!templateDetail) {
      res.json({
        code: "error",
        message: "Template does not exist!"
      })
      return;
    }
    
    req.body.search = toSearchText(`${req.body.name} ${req.body.slug}`)

    await Template.updateOne({
      _id: id,
      deleted: false
    }, req.body);

    res.json({
      code: "success",
      message: "Template updated successfully!"
    });
  } catch (error) {
    console.log(error);
    res.json({
      code: "error",
      message: "Invalid data!"
    })
  }
}

export const deletePatch = async (req: Request, res: Response) => {
  try {
    await Template.deleteOne({ _id: req.params.id });
    res.json({ code: "success", message: "Template deleted successfully!" });
  } catch (error) {
    res.json({ code: "error", message: "Invalid ID!" });
  }
}