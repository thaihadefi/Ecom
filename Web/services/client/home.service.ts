import { getGeneral } from '../../configs/setting.config';
import Product from '../../models/product.model';
import Blog from '../../models/blog.model';
import { pathAdmin } from '../../configs/variable.config';
import { getBlockListByTemplate } from '../../helpers/block.helper';

export const getHomeBlocks = async () => {
  return getBlockListByTemplate("/");
};

export const generateSitemapXml = async (): Promise<string> => {
  const settingGeneral = await getGeneral();
  const domain = settingGeneral.domainWebsite || "";

  const urls: string[] = [];

  urls.push(`
    <url>
      <loc>${domain}/</loc>
      <changefreq>daily</changefreq>
      <priority>1.0</priority>
    </url>
  `);

  const [productList, blogList] = await Promise.all([
    Product.find({ deleted: false, status: "active" }).select("slug updatedAt"),
    Blog.find({ deleted: false, status: "published" }).select("slug updatedAt")
  ]);

  productList.forEach(item => {
    urls.push(`
      <url>
        <loc>${domain}/product/detail/${item.slug}</loc>
        <lastmod>${item.updatedAt.toISOString()}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
      </url>
    `);
  });

  blogList.forEach(item => {
    urls.push(`
      <url>
        <loc>${domain}/article/detail/${item.slug}</loc>
        <lastmod>${item.updatedAt.toISOString()}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.7</priority>
      </url>
    `);
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      ${urls.join("")}
    </urlset>
  `;
};

export const getRobotsContent = (): string => {
  return `
    User-agent: *
    Disallow: /${pathAdmin}/
  `;
};
