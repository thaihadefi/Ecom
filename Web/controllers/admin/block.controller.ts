import { toSearchText } from '../../helpers/slugify.helper';
import { Request, Response } from "express";
import path from "path";
import fs from "fs";
import Block from "../../models/block.model";
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
  const totalRecord = await Block.countDocuments(find);
  const pagination = getPagination(req.query.page, limitItems, totalRecord);
  // End Pagination

  const recordList = await Block
    .find(find)
    .select("_id name slug fileName status createdAt")
    .limit(limitItems)
    .skip(pagination.skip)
    .sort({ createdAt: "desc" })
  
  res.render("admin/pages/block-list", {
    pageTitle: "Manage Blocks",
    recordList: recordList,
    pagination: pagination
  });
}

export const create = async (req: Request, res: Response) => {
  // Get path
  const blocksDir = path.join(process.cwd(), "views", "client", "blocks"); // process.cwd() root directory
  
  // Get files list
  const fileList = fs.readdirSync(blocksDir);

  res.render("admin/pages/block-create", {
    pageTitle: "Create Block",
    fileList: fileList
  });
}

export const createPost = async (req: Request, res: Response) => {
  try {
    req.body.search = toSearchText(`${req.body.name} ${req.body.fileName}`)

    const newRecord = new Block(req.body);
    await newRecord.save();

    res.json({
      code: "success",
      message: "Block created successfully!"
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
    // Get path
    const blocksDir = path.join(process.cwd(), "views", "client", "blocks"); // process.cwd() root directory
    
    // Get files list
    const fileList = fs.readdirSync(blocksDir);
    
    const blockDetail = await Block.findOne({
      _id: req.params.id,
      deleted: false
    });

    if(!blockDetail) {
      res.redirect(`/${pathAdmin}/block/list`);
      return;
    }

    res.render("admin/pages/block-edit", {
      pageTitle: "Edit Block",
      fileList: fileList,
      blockDetail: blockDetail
    });
  } catch (error) {
    console.log(error);
    res.redirect(`/${pathAdmin}/block/list`);
  }
}

export const editPatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    const blockDetail = await Block.findOne({
      _id: id,
      deleted: false
    });

    if(!blockDetail) {
      res.json({
        code: "error",
        message: "Block does not exist!"
      })
      return;
    }
    
    req.body.search = toSearchText(`${req.body.name} ${req.body.fileName}`)

    await Block.updateOne({
      _id: id,
      deleted: false
    }, req.body);

    res.json({
      code: "success",
      message: "Block updated successfully!"
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
    await Block.deleteOne({ _id: req.params.id });
    res.json({ code: "success", message: "Block deleted successfully!" });
  } catch (error) {
    res.json({ code: "error", message: "Invalid ID!" });
  }
}