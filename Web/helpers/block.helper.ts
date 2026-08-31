import { Request, Response } from "express";
import path from "path";
import pug from "pug";
import { mediaBase, flashSaleConfig } from "../configs/variable.config";
import { formatDateTime, formatVND } from "./format.helper";
import Template from "../models/template.model";
import Block from "../models/block.model";
import { getBlogByCategory, getProductByCategory } from "./product.helper";
import { ITemplateBlock } from "../interfaces/models/template.interface";

type BlockData = Record<string, unknown>;

interface BlockDataWithCategory extends BlockData {
  getByCategory?: { type?: string; category?: string[]; limit?: number; sort?: { by: string; type: string } };
  tabs?: Array<BlockData & { getByCategory?: { type?: string } }>;
}

export const renderHTML = async (_req: Request, res: Response, blockList: Array<{ fileName?: string | null; data?: unknown }>) => {
  if (!blockList || blockList.length === 0) return [];

  const blocksPromises = blockList.map(async (block) => {
    if (!block || !block.fileName) return null;
    const blockPath = path.join(process.cwd(), "views", "client", "blocks", `${block.fileName}`);
    const blockData = block.data as BlockDataWithCategory | undefined;
    try {
      let productListPromise = Promise.resolve([] as unknown[]);
      if (blockData?.getByCategory?.type === "product") {
        productListPromise = getProductByCategory(blockData.getByCategory);
      }

      let blogListPromise = Promise.resolve([] as unknown[]);
      if (blockData?.getByCategory?.type === "blog") {
        blogListPromise = getBlogByCategory(blockData.getByCategory);
      }

      let tabListPromise: Promise<unknown[]> = Promise.resolve([]);
      const tabs = blockData?.tabs;
      if (tabs && tabs.length > 0) {
        const tabPromises = tabs.map(async (tab) => {
          if (tab.getByCategory?.type === "product") {
            const productListByTab = await getProductByCategory(tab.getByCategory);
            return {
              ...tab,
              productList: productListByTab
            };
          }
          return tab;
        });
        tabListPromise = Promise.all(tabPromises);
      }

      const [productList, blogList, tabList] = await Promise.all([
        productListPromise,
        blogListPromise,
        tabListPromise
      ]);

      const renderedBlockData = block.fileName === "flash-sale.pug" && blockData
        ? { ...blockData, endTime: flashSaleConfig.endTime }
        : blockData;

      const html = pug.renderFile(blockPath, {
        categoryProductList: res.locals.categoryProductList,
        domainCDN: mediaBase,
        formatDateTime,
        formatVND,
        getFullUrl: (url: string) => {
          if (!url) return "";
          if (url.startsWith("http://") || url.startsWith("https://")) return url;
          if (url.startsWith("/client/") || url.startsWith("client/")) return url;
          if (url.startsWith("/images/") || url.startsWith("images/")) return url;
          return `${mediaBase}${url.startsWith("/") ? "" : "/"}${url}`;
        },
        blockData: renderedBlockData,
        blockProductList: productList,
        blockTabList: tabList,
        blockBlogList: blogList
      });
      return html;
    } catch (error) {
      console.error(`Render error for block: ${block.fileName}`, error);
      return null;
    }
  });

  const renderedHtmls = await Promise.all(blocksPromises);
  return renderedHtmls.filter((html) => html !== null) as string[];
};

export const getBlockListByTemplate = async (slug: string) => {
  const template = await Template.findOne({
    slug: slug,
    deleted: false,
    status: "active"
  }).select("blocks");

  if (!template || !template.blocks) {
    console.warn(`Warning: Template with slug "${slug}" not found in database. Returning empty block list.`);
    return [];
  }

  const blockIds = template.blocks
    .map((item: ITemplateBlock) => String(item.blockId))
    .filter((id): id is string => Boolean(id) && id !== "undefined");

  const blockList = await Block.find({
    _id: { $in: blockIds },
    deleted: false,
    status: "active"
  }).select("_id fileName data");

  const sortedBlocks = blockIds
    .map((blockId) => blockList.find((block) => block && String(block._id) == blockId))
    .filter((block): block is NonNullable<typeof block> => block !== undefined);

  return sortedBlocks;
};
