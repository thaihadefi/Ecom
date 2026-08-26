import path from "path";
import fs from "fs";
import Block from "../../models/block.model";
import { IBlock, IBlockInput } from '../../interfaces/models/block.interface';
import { toSearchText } from '../../helpers/slugify.helper';
import { escapeRegex } from '../../helpers/generate.helper';
import { PAGINATION } from '../../configs/pagination.config';
import { getPagination } from '../../helpers/pagination.helper';

export const getBlockList = async (rawKeyword?: unknown, rawPage?: unknown) => {
  const find: {
    deleted: boolean;
    search?: RegExp;
  } = {
    deleted: false
  };

  if (rawKeyword) {
    const keyword = toSearchText(`${rawKeyword}`);
    const keywordRegex = new RegExp(escapeRegex(keyword), "i");
    find.search = keywordRegex;
  }

  const limitItems = PAGINATION.ADMIN_LIMIT;
  const totalRecord = await Block.countDocuments(find);
  const pagination = getPagination(rawPage, limitItems, totalRecord);

  const recordList = await Block
    .find(find)
    .select("_id name slug fileName status createdAt")
    .limit(limitItems)
    .skip(pagination.skip)
    .sort({ createdAt: "desc" });

  return {
    recordList,
    pagination
  };
};

export const getBlockTemplateFiles = () => {
  const blocksDir = path.join(process.cwd(), "views", "client", "blocks");
  if (!fs.existsSync(blocksDir)) return [];
  return fs.readdirSync(blocksDir);
};

export const createBlock = async (data: IBlockInput): Promise<IBlock> => {
  data.search = toSearchText(`${data.name} ${data.fileName}`);
  const newRecord = new Block(data);
  await newRecord.save();
  return newRecord;
};

export const getBlockById = async (id: string) => {
  return Block.findOne({ _id: id, deleted: false });
};

export const updateBlock = async (id: string, data: IBlockInput): Promise<{ success: boolean; message: string }> => {
  const blockDetail = await Block.findOne({ _id: id, deleted: false });
  if (!blockDetail) {
    return { success: false, message: "Block does not exist!" };
  }

  data.search = toSearchText(`${data.name} ${data.fileName}`);
  await Block.updateOne({ _id: id, deleted: false }, data);

  return { success: true, message: "Block updated successfully!" };
};

export const deleteBlock = async (id: string) => {
  await Block.deleteOne({ _id: id });
  return { success: true, message: "Block deleted successfully!" };
};
