import { Request, Response } from "express";
import path from "path";
import pug from "pug";
import { mediaBase, flashSaleConfig } from "../configs/variable.config";
import { FEATURES } from "../configs/features.config";
import { formatDate, formatDateTime, formatPrice, formatNumber, priceHtml } from "./format.helper";
import { safeHtml, safeUrl, safeColor } from "./html-sanitize.helper";
import Template from "../models/template.model";
import Block from "../models/block.model";
import { getBlogByCategory, getProductByCategory } from "./product.helper";
import { ITemplateBlock } from "../interfaces/models/template.interface";
import { metadataCache, CACHE_KEYS } from "./metadata-cache.helper";

type BlockData = Record<string, unknown>;

interface BlockDataWithCategory extends BlockData {
  getByCategory?: { type?: string; category?: string[]; limit?: number; sort?: { by: string; type: string } };
  tabs?: Array<BlockData & { getByCategory?: { type?: string } }>;
}

export const renderHTML = async (_req: Request, res: Response, blockList: Array<{ fileName?: string | null; data?: unknown }>) => {
  if (!blockList || blockList.length === 0) return [];

  const blocksDir = path.join(process.cwd(), "views", "client", "blocks");

  // Product and article lists load in parallel; rendering then walks the blocks in page order.
  const loadedBlocks = await Promise.all(blockList.map(async (block) => {
    if (!block || !block.fileName) return null;
    // A block that belongs to a switched-off module is skipped.
    if (!FEATURES.BLOG && block.fileName === "blog.pug") return null;
    const blockPath = path.join(blocksDir, path.basename(`${block.fileName}`));
    if (!blockPath.endsWith(".pug")) return null;
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

      let tabListPromise: Promise<Array<BlockData & { productList?: unknown[] }>> = Promise.resolve([]);
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
      return { fileName: block.fileName, blockPath, blockData, productList, blogList, tabList };
    } catch (error) {
      console.error(`Load error for block: ${block.fileName}`, error);
      return null;
    }
  }));

  // A product already shown by an earlier block is left out of later ones, so a small catalog does not repeat
  // the same items section after section; a product section left with nothing to show is dropped.
  const shownProductIds = new Set<string>();
  const productId = (item: unknown) => String((item as { _id?: unknown; id?: unknown })._id ?? (item as { id?: unknown }).id);
  const unseen = (list: unknown[]) => list.filter((item) => !shownProductIds.has(productId(item)));

  const renderedHtmls = loadedBlocks.map((loaded) => {
    if (!loaded) return null;
    const { fileName, blockPath, blockData } = loaded;
    const loadsProducts = blockData?.getByCategory?.type === "product" || loaded.tabList.some((tab) => Array.isArray(tab.productList));
    const productList = unseen(loaded.productList);
    const tabList = loaded.tabList.map((tab) => (Array.isArray(tab.productList) ? { ...tab, productList: unseen(tab.productList) } : tab));
    const visibleProducts = [...productList, ...tabList.flatMap((tab) => tab.productList || [])];
    if (loadsProducts && visibleProducts.length === 0) return null;
    visibleProducts.forEach((item) => shownProductIds.add(productId(item)));

    try {
      const renderedBlockData = fileName === "flash-sale.pug" && blockData
        ? { ...blockData, endTime: blockData.endTime || flashSaleConfig.endTime }
        : blockData;

      return pug.renderFile(blockPath, {
        cache: true,
        categoryProductList: res.locals.categoryProductList,
        domainCDN: mediaBase,
        FEATURES,
        formatDate,
        formatDateTime,
        formatPrice,
        formatNumber,
        priceHtml,
        safeHtml,
        safeUrl,
        safeColor,
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
        blockBlogList: loaded.blogList
      });
    } catch (error) {
      console.error(`Render error for block: ${fileName}`, error);
      return null;
    }
  });

  return renderedHtmls.filter((html) => html !== null) as string[];
};

export const getBlockListByTemplate = async (slug: string) => {
  const cacheKey = slug === "/" ? CACHE_KEYS.HOME_BLOCK_LIST : `template:blocks:${slug}`;
  const cached = metadataCache.get<Array<{ _id: unknown; fileName?: string | null; data?: unknown }>>(cacheKey);
  if (cached) return cached;

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

  metadataCache.set(cacheKey, sortedBlocks, 300);
  return sortedBlocks;
};

