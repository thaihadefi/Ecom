import { Request, Response } from "express";
import path from "path";
import pug from "pug";
import { domainCDN, flashSaleConfig } from "../configs/variable.config";
import { formatDateTime, formatVND } from "./format.helper";
import Template from "../models/template.model";
import Block from "../models/block.model";
import { getBlogByCategory, getProductByCategory } from "./product.helper";

export const renderHTML = async (req: Request, res: Response, blockList: any) => {
  if (!blockList || blockList.length === 0) return [];
  
  const blocksPromises = blockList.map(async (block: any) => {
    if (!block) return null;
    const blockPath = path.join(process.cwd(), "views", "client", "blocks", `${block.fileName}`);
    try {
      // Parallelize productList, tabList, and blogList fetching for THIS block
      let productListPromise = Promise.resolve([] as any[]);
      if (block.data?.getByCategory?.type === "product") {
        productListPromise = getProductByCategory(block.data.getByCategory);
      }

      let blogListPromise = Promise.resolve([] as any[]);
      if (block.data?.getByCategory?.type === "blog") {
        blogListPromise = getBlogByCategory(block.data.getByCategory);
      }

      let tabListPromise = Promise.resolve([] as any[]);
      if (block.data?.tabs?.length > 0) {
        const tabPromises = block.data.tabs.map(async (tab: any) => {
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

      // For flash sale block, config file overrides DB endTime
      const blockData = block.fileName === "flash-sale.pug" && block.data
        ? { ...block.data, endTime: flashSaleConfig.endTime }
        : block.data;

      const html = pug.renderFile(blockPath, {
        categoryProductList: res.locals.categoryProductList,
        domainCDN: domainCDN,
        formatDateTime,
        formatVND,
        getFullUrl: (url: string) => {
          if (!url) return "";
          if (url.startsWith("http://") || url.startsWith("https://")) return url;
          if (url.startsWith("/client/") || url.startsWith("client/")) return url;
          if (url.startsWith("/images/") || url.startsWith("images/")) return url;
          return `${domainCDN}${url.startsWith("/") ? "" : "/"}${url}`;
        },
        blockData: blockData,
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
}

export const getBlockListByTemplate = async (slug: string) => {
  const template: any = await Template.findOne({
    slug: slug,
    deleted: false,
    status: "active"
  }).select("blocks")

  if (!template || !template.blocks) {
    console.warn(`Warning: Template with slug "${slug}" not found in database. Returning empty block list.`);
    return [];
  }

  const blockIds = template.blocks.map((item: any) => item.blockId);

  const blockList = await Block.find({
    _id: { $in: blockIds },
    deleted: false,
    status: "active"
  }).select("_id fileName data");

  const sortedBlocks = blockIds.map((blockId: string) => {
    return blockList.find((block: any) => block && block.id == blockId);
  }).filter((block: any) => block !== undefined);

  return sortedBlocks;
}