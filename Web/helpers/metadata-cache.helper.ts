import NodeCache from "node-cache";

export const metadataCache = new NodeCache({ stdTTL: 600, checkperiod: 60 });

export const CACHE_KEYS = {
  CATEGORY_PRODUCT_TREE: "metadata:category_product_tree",
  CATEGORY_BLOG_TREE: "metadata:category_blog_tree",
  ACTIVE_ATTRIBUTES: "metadata:active_attributes",
  HOME_BLOCK_LIST: "metadata:home_block_list",
};

export const invalidateProductCaches = (slug?: string) => {
  const keys = metadataCache.keys();
  const toDel: string[] = [];
  if (slug) {
    toDel.push(`product:detail:${slug}`);
  }
  for (const k of keys) {
    if (
      (!slug && k.startsWith("product:detail:")) ||
      k.startsWith("catalog:") ||
      k.startsWith("category:slug:") ||
      k.startsWith("product:top_rated:") ||
      k.startsWith("suggestions:") ||
      k.startsWith("search:") ||
      k.startsWith("home:blocks_html") ||
      k.startsWith("seo:sitemap_xml")
    ) {
      toDel.push(k);
    }
  }
  if (toDel.length > 0) {
    metadataCache.del(toDel);
  }
};

export const invalidateCategoryProductTree = () => {
  metadataCache.del(CACHE_KEYS.CATEGORY_PRODUCT_TREE);
  invalidateProductCaches();
};

export const invalidateCategoryBlogTree = () => {
  metadataCache.del(CACHE_KEYS.CATEGORY_BLOG_TREE);
  invalidateArticleCaches();
};

export const invalidateActiveAttributes = () => {
  metadataCache.del(CACHE_KEYS.ACTIVE_ATTRIBUTES);
  invalidateProductCaches();
};

export const invalidateHomeBlockList = () => {
  const keys = metadataCache.keys();
  const toDel: string[] = [CACHE_KEYS.HOME_BLOCK_LIST];
  for (const k of keys) {
    if (k.startsWith("home:blocks_html") || k.startsWith("template:blocks:")) {
      toDel.push(k);
    }
  }
  metadataCache.del(toDel);
};

export const invalidateArticleCaches = (slug?: string) => {
  const keys = metadataCache.keys();
  const toDel: string[] = [];
  if (slug) {
    toDel.push(`article:detail:${slug}`);
  }
  for (const k of keys) {
    if (
      (!slug && k.startsWith("article:detail:")) ||
      k.startsWith("article:list:") ||
      k.startsWith("article:cat:") ||
      k.startsWith("article:popular") ||
      k.startsWith("category_blog:slug:") ||
      k.startsWith("search:") ||
      k.startsWith("seo:sitemap_xml")
    ) {
      toDel.push(k);
    }
  }
  if (toDel.length > 0) {
    metadataCache.del(toDel);
  }
};
