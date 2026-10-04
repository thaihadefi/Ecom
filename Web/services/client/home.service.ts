import Product from '../../models/product.model';
import Blog from '../../models/blog.model';
import CategoryProduct from '../../models/category-product.model';
import CategoryBlog from '../../models/category-blog.model';
import { CONTENT_PAGES } from '../../configs/content-pages.config';
import { FEATURES } from '../../configs/features.config';
import { pathAdmin } from '../../configs/variable.config';
import { getBlockListByTemplate } from '../../helpers/block.helper';

export const getHomeBlocks = async () => {
  return getBlockListByTemplate("/");
};

const xmlEscape = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

type SitemapEntry = { path: string; lastmod?: Date };

// Indexable public pages only: no private routes, no markdown twins, and nothing whose saved SEO says noindex.
export const generateSitemapXml = async (origin: string): Promise<string> => {
  const notNoindex = { "seo.robots.index": { $ne: false } };
  const [productList, blogList, productCategories, blogCategories] = await Promise.all([
    Product.find({ deleted: false, status: "active", ...notNoindex }).select("slug updatedAt"),
    FEATURES.BLOG ? Blog.find({ deleted: false, status: "published", ...notNoindex }).select("slug updatedAt") : [],
    CategoryProduct.find({ deleted: false, status: "active" }).select("slug updatedAt"),
    FEATURES.BLOG ? CategoryBlog.find({ deleted: false, status: "active" }).select("slug updatedAt") : [],
  ]);

  const entries: SitemapEntry[] = [
    { path: "/" },
    { path: "/product" },
    ...productCategories.map((c) => ({ path: `/product/category/${encodeURIComponent(String(c.slug))}`, lastmod: c.updatedAt })),
    ...productList.map((p) => ({ path: `/product/detail/${encodeURIComponent(String(p.slug))}`, lastmod: p.updatedAt })),
  ];
  if (FEATURES.BLOG) {
    entries.push({ path: "/article" });
    entries.push(...blogCategories.map((c) => ({ path: `/article/category/${encodeURIComponent(String(c.slug))}`, lastmod: c.updatedAt })));
    entries.push(...blogList.map((b) => ({ path: `/article/detail/${encodeURIComponent(String(b.slug))}`, lastmod: b.updatedAt })));
  }
  entries.push({ path: "/contact" }, ...CONTENT_PAGES.map((page) => ({ path: page.path })));

  const urls = entries.map((entry) =>
    `  <url><loc>${xmlEscape(origin + entry.path)}</loc>${entry.lastmod ? `<lastmod>${entry.lastmod.toISOString()}</lastmod>` : ""}</url>`
  );

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>
`;
};

// Crawler policy: everything public is open to search engines and to AI search, user-fetch and
// training crawlers alike; private and transactional pages carry noindex instead of a Disallow
// so crawlers can still read that tag. Restricting AI crawlers is a store-owner decision.
export const getRobotsContent = (origin: string): string =>
  [
    "User-agent: *",
    `Disallow: /${pathAdmin}/`,
    "",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n");
