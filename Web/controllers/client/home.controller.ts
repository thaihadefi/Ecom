import { Request, Response } from 'express';
import { renderHTML } from '../../helpers/block.helper';
import * as homeService from '../../services/client/home.service';

export const home = async (req: Request, res: Response) => {
  const blockList = await homeService.getHomeBlocks();
  const blocksHtml = await renderHTML(req, res, blockList);

  res.render("client/pages/home", {
    pageTitle: "Home",
    blocksHtml: blocksHtml
  });
};

export const sitemap = async (_req: Request, res: Response) => {
  try {
    const sitemapXml = await homeService.generateSitemapXml();
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
