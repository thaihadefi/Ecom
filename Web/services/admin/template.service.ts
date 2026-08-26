import Block from "../../models/block.model";
import Template from "../../models/template.model";
import { ITemplate, ITemplateInput } from "../../interfaces/models/template.interface";
import { toSearchText } from '../../helpers/slugify.helper';
import { escapeRegex } from '../../helpers/generate.helper';
import { PAGINATION } from '../../configs/pagination.config';
import { getPagination } from '../../helpers/pagination.helper';

export const getTemplateList = async (rawKeyword?: unknown, rawPage?: unknown) => {
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
  const totalRecord = await Template.countDocuments(find);
  const pagination = getPagination(rawPage, limitItems, totalRecord);

  const recordList = await Template.find(find)
    .select("_id name slug status blocks")
    .limit(limitItems)
    .skip(pagination.skip)
    .sort({ name: "asc" });

  return {
    recordList,
    pagination
  };
};

export const getActiveBlocksForTemplate = async () => {
  return Block
    .find({ deleted: false, status: "active" })
    .select("_id name fileName slug status")
    .sort({ name: "asc" });
};

export const createTemplate = async (data: ITemplateInput): Promise<{ success: boolean; message: string; template?: ITemplate }> => {
  const existSlug = await Template.findOne({
    slug: String(data.slug || ""),
    deleted: false
  }).select("_id");

  if (existSlug) {
    return { success: false, message: "Template slug already exists!" };
  }

  if (typeof data.blocks === "string") {
    data.blocks = JSON.parse(data.blocks);
  }

  data.search = toSearchText(`${data.name}`);
  const newRecord = new Template(data);
  await newRecord.save();

  return { success: true, message: "Template created successfully!", template: newRecord };
};

export const getTemplateById = async (id: string) => {
  return Template.findOne({ _id: id, deleted: false });
};

export const getTemplateDetailPopulated = async (id: string) => {
  const templateDetail = await Template.findOne({ _id: id, deleted: false });
  if (!templateDetail) return null;

  const blockIds = templateDetail.blocks
    .map((b) => String(b.blockId))
    .filter((id): id is string => Boolean(id) && id !== "undefined");

  const blockDetails = await Block.find({ _id: { $in: blockIds }, deleted: false }).select("_id name fileName");
  const blockDetailMap = new Map(blockDetails.map((b) => [String(b._id), b]));

  const missingBlockIds: string[] = [];
  for (const block of templateDetail.blocks) {
    const blockDetail = blockDetailMap.get(String(block.blockId));
    if (!blockDetail) {
      if (block.blockId) missingBlockIds.push(String(block.blockId));
    } else {
      block.name = blockDetail.name;
      block.fileName = blockDetail.fileName;
    }
  }
  if (missingBlockIds.length > 0) {
    await Template.updateOne(
      { _id: id, deleted: false },
      { $pull: { blocks: { blockId: { $in: missingBlockIds } } } }
    );
  }

  templateDetail.blocks.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  return templateDetail;
};

export const getTemplateDetailForEdit = async (id: string) => {
  const templateDetail = await Template.findOne({
    _id: id,
    deleted: false
  });

  if (!templateDetail) {
    return null;
  }

  const blockIds = templateDetail.blocks
    .map((b) => String(b.blockId))
    .filter((id): id is string => Boolean(id) && id !== "undefined");

  const [blockDetails, blockList] = await Promise.all([
    Block.find({ _id: { $in: blockIds }, deleted: false }).select("_id name fileName"),
    Block.find({ deleted: false, status: "active" }).select("_id name fileName slug status").sort({ name: "asc" })
  ]);
  const blockDetailMap = new Map(blockDetails.map((b) => [String(b._id), b]));

  const missingBlockIds: string[] = [];
  for (const block of templateDetail.blocks) {
    const blockDetail = blockDetailMap.get(String(block.blockId));
    if (!blockDetail) {
      if (block.blockId) missingBlockIds.push(String(block.blockId));
    } else {
      block.name = blockDetail.name;
      block.fileName = blockDetail.fileName;
    }
  }
  if (missingBlockIds.length > 0) {
    await Template.updateOne(
      { _id: id, deleted: false },
      { $pull: { blocks: { blockId: { $in: missingBlockIds } } } }
    );
  }

  return {
    templateDetail,
    blockList
  };
};

export const updateTemplate = async (id: string, data: ITemplateInput): Promise<{ success: boolean; message: string }> => {
  const existSlug = await Template.findOne({
    _id: { $ne: id },
    slug: String(data.slug || ""),
    deleted: false
  }).select("_id");

  if (existSlug) {
    return { success: false, message: "Template slug already exists!" };
  }

  if (typeof data.blocks === "string") {
    data.blocks = JSON.parse(data.blocks);
  }

  data.search = toSearchText(`${data.name}`);
  await Template.updateOne({ _id: id, deleted: false }, data);

  return { success: true, message: "Updated successfully!" };
};

export const deleteTemplate = async (id: string) => {
  await Template.deleteOne({ _id: id });
  return { success: true, message: "Template deleted successfully!" };
};
