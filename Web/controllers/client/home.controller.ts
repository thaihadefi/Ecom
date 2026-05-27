import { Request, Response } from 'express';
import { getGeneral } from '../../configs/setting.config';
import Product from '../../models/product.model';
import Blog from '../../models/blog.model';
import { pathAdmin } from '../../configs/variable.config';
import { getBlockListByTemplate, renderHTML } from '../../helpers/block.helper';

export const home = async (req: Request, res: Response) => {
  const blockList = await getBlockListByTemplate("/");

  const blocksHtml = await renderHTML(req, res, blockList);
  
  res.render("client/pages/home", {
    pageTitle: "Home",
    blocksHtml: blocksHtml
  });
}

export const sitemap = async (req: Request, res: Response) => {
  try {
    const settingGeneral = await getGeneral();
    const domain = settingGeneral.domainWebsite;

    let urls: string[] = [];

    /*
      url: Represents a page to be indexed by Google
      loc (location): Full URL of the page
      lastmod: Last update time
      changefreq: Change frequency (always, hourly, daily, weekly, monthly, yearly, never)
      priority: Importance level (relative priority compared to other URLs in the site)
    */

    // Home Page
    urls.push(`
      <url>
        <loc>${domain}/</loc>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
      </url>
    `);

    // Products
    const productList = await Product.find({
      deleted: false,
      status: "active"
    }).select("slug updatedAt");

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

    // Articles
    const blogList = await Blog.find({
      deleted: false,
      status: "published"
    }).select("slug updatedAt");

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

    // XML sitemap
    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        ${urls.join("")}
      </urlset>
    `;

    res.header("Content-Type", "application/xml");
    res.send(sitemapXml);

  } catch (error) {
    console.log(error);
    res.send("Error generating sitemap for the website.");
  }
};

export const robots = async (req: Request, res: Response) => {
  const content = `
    User-agent: *
    Disallow: /${pathAdmin}/
  `;

  /*
    User-agent: * applies to all search crawlers/bots
    Disallow: /admin/ restricts bot crawling from any URL starting with /admin/
  */

  res.type('text/plain');
  res.send(content);
}