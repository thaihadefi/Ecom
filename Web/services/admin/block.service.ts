import path from "path";
import fs from "fs";
import Block from "../../models/block.model";
import { IBlock, IBlockInput } from '../../interfaces/models/block.interface';
import { toSearchText } from '../../helpers/slugify.helper';
import { paginatedSearch } from "../../helpers/list-query.helper";

export const getBlockList = async (rawKeyword?: unknown, rawPage?: unknown) => {
  const { recordList, pagination } = await paginatedSearch(Block, rawKeyword, rawPage, { select: "_id name slug fileName status createdAt" });

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
