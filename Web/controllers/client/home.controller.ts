import { Request, Response } from 'express';
import { renderHTML } from '../../helpers/block.helper';
import * as homeService from '../../services/client/home.service';
import { metadataCache } from '../../helpers/metadata-cache.helper';
import { plainText } from '../../helpers/seo.helper';
import { storeName } from '../../helpers/structured-data.helper';
import { siteOrigin } from '../../middlewares/client/seo.middleware';

export const home = async (req: Request, res: Response) => {
  let blocksHtml = metadataCache.get<string[]>("home:blocks_html");
  if (!blocksHtml) {
    const blockList = await homeService.getHomeBlocks();
    blocksHtml = await renderHTML(req, res, blockList);
    metadataCache.set("home:blocks_html", blocksHtml, 120);
  }

  // The home title and hidden H1 say what the store is, from Settings > General.
  const general = res.locals.settingGeneral || {};
  const name = storeName(general);
  // First sentence of the store description keeps the title readable in search results.
  const tagline = ((general.storeDescription || "").trim().match(/^.*?[.!?](?=\s|$)/) || [general.storeDescription || ""])[0].trim();

  res.render("client/pages/home", {
    pageTitle: tagline ? `${name}: ${plainText(tagline, 70)}` : name,
    fullTitle: true,
    blocksHtml: blocksHtml,
    markdownPath: "/index.md"
  });
};


export const sitemap = async (req: Request, res: Response) => {
  try {
    let sitemapXml = metadataCache.get<string>("seo:sitemap_xml");
    if (!sitemapXml) {
      sitemapXml = await homeService.generateSitemapXml(res.locals.siteOrigin || await siteOrigin(req));
      metadataCache.set("seo:sitemap_xml", sitemapXml, 3600);
    }
    res.header("Content-Type", "application/xml");
    res.send(sitemapXml);
  } catch (error) {
    console.error("Error generating sitemap:", error);
    res.status(500).send("Error generating sitemap for the website.");
  }
};

export const robots = async (req: Request, res: Response) => {
  const content = homeService.getRobotsContent(res.locals.siteOrigin || await siteOrigin(req));
  res.type('text/plain');
  res.send(content);
};
