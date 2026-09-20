import Block from "../../models/block.model";
import Template from "../../models/template.model";
import { ITemplate, ITemplateInput } from "../../interfaces/models/template.interface";
import { toSearchText } from '../../helpers/slugify.helper';
import { paginatedSearch } from "../../helpers/list-query.helper";
import { invalidateHomeBlockList } from "../../helpers/metadata-cache.helper";

export const getTemplateList = async (rawKeyword?: unknown, rawPage?: unknown) => {
  const { recordList, pagination } = await paginatedSearch(Template, rawKeyword, rawPage, { select: "_id name slug status blocks", sort: { name: "asc" } });

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

export const createTemplate = async (data: ITemplateInput): Promise<{ success: boolean; status?: number; message: string; template?: ITemplate }> => {
  const existSlug = await Template.findOne({
    slug: String(data.slug || ""),
    deleted: false
  }).select("_id");

  if (existSlug) {
    return { success: false, status: 409, message: "Template slug already exists!" };
  }

  if (typeof data.blocks === "string") {
    data.blocks = JSON.parse(data.blocks);
  }

  data.search = toSearchText(`${data.name}`);
  const newRecord = new Template(data);
  await newRecord.save();
  invalidateHomeBlockList();

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

  // Blocks that no longer exist stay in the stored list until the template is saved again; opening it must not write.
  for (const block of templateDetail.blocks) {
    const blockDetail = blockDetailMap.get(String(block.blockId));
    if (blockDetail) {
      block.name = blockDetail.name;
      block.fileName = blockDetail.fileName;
    }
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

  // Blocks that no longer exist stay in the stored list until the template is saved again; opening it must not write.
  for (const block of templateDetail.blocks) {
    const blockDetail = blockDetailMap.get(String(block.blockId));
    if (blockDetail) {
      block.name = blockDetail.name;
      block.fileName = blockDetail.fileName;
    }
  }

  return {
    templateDetail,
    blockList
  };
};

export const updateTemplate = async (id: string, data: ITemplateInput): Promise<{ success: boolean; status?: number; message: string }> => {
  const existSlug = await Template.findOne({
    _id: { $ne: id },
    slug: String(data.slug || ""),
    deleted: false
  }).select("_id");

  if (existSlug) {
    return { success: false, status: 409, message: "Template slug already exists!" };
  }

  if (typeof data.blocks === "string") {
    data.blocks = JSON.parse(data.blocks);
  }

  data.search = toSearchText(`${data.name}`);
  await Template.updateOne({ _id: id, deleted: false }, data);
  invalidateHomeBlockList();

  return { success: true, message: "Updated successfully!" };
};

export const deleteTemplate = async (id: string) => {
  await Template.deleteOne({ _id: id });
  invalidateHomeBlockList();
  return { success: true, message: "Template deleted successfully!" };
};
