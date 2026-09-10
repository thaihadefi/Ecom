import { Request, Response } from 'express';
import { renderHTML } from '../../helpers/block.helper';
import * as homeService from '../../services/client/home.service';
import { metadataCache } from '../../helpers/metadata-cache.helper';

export const home = async (req: Request, res: Response) => {
  let blocksHtml = metadataCache.get<string[]>("home:blocks_html");
  if (!blocksHtml) {
    const blockList = await homeService.getHomeBlocks();
    blocksHtml = await renderHTML(req, res, blockList);
    metadataCache.set("home:blocks_html", blocksHtml, 120);
  }

  res.render("client/pages/home", {
    pageTitle: "Home",
    blocksHtml: blocksHtml
  });
};


export const sitemap = async (_req: Request, res: Response) => {
  try {
    let sitemapXml = metadataCache.get<string>("seo:sitemap_xml");
    if (!sitemapXml) {
      sitemapXml = await homeService.generateSitemapXml();
      metadataCache.set("seo:sitemap_xml", sitemapXml, 3600);
    }
    res.header("Content-Type", "application/xml");
    res.send(sitemapXml);
  } catch (error) {
    console.error("Error generating sitemap:", error);
    res.status(500).send("Error generating sitemap for the website.");
  }
};

export const robots = async (_req: Request, res: Response) => {
  const content = homeService.getRobotsContent();
  res.type('text/plain');
  res.send(content);
};
