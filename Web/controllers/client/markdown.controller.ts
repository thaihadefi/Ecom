import { Request, Response } from "express";
import * as markdownService from "../../services/client/markdown.service";
import { CONTENT_PAGES } from "../../configs/content-pages.config";

type ContentPage = (typeof CONTENT_PAGES)[number];

// Markdown copies stay crawlable but out of search results, so they never compete with the HTML page.
const sendText = (res: Response, body: string, type: "markdown" | "plain") => {
  res.set("Content-Type", `text/${type}; charset=utf-8`);
  res.set("X-Robots-Tag", "noindex");
  res.send(body);
};

const notFound = (res: Response) => {
  res.status(404).set("X-Robots-Tag", "noindex").type("text/plain").send("Not found");
};

const origin = (res: Response): string => res.locals.siteOrigin;

const sendPage = (res: Response, page: markdownService.MarkdownPage | null) => {
  if (!page) return notFound(res);
  sendText(res, markdownService.renderMarkdownPage(page), "markdown");
};

// A page that still shows its default copy has its text only in the Pug view: render it and keep the main column.
const renderViewMarkdown = (res: Response, view: string, locals: Record<string, unknown>): Promise<string> =>
  new Promise((resolve, reject) => {
    res.render(view, locals, (err, html) => {
      if (err) return reject(err);
      const main = html.match(/<main id="main-content">([\s\S]*)<\/main>/)?.[1] || "";
      resolve(markdownService.htmlToMarkdown(main.replace(/<section class="page_banner">[\s\S]*?<\/section>/, ""), origin(res)));
    });
  });

const contentPageMarkdown = async (res: Response, page: ContentPage): Promise<markdownService.MarkdownPage> => {
  const saved = await markdownService.savedContentPageHtml(page.key);
  const body = saved
    ? markdownService.htmlToMarkdown(saved, origin(res))
    : await renderViewMarkdown(res, page.view, { pageTitle: page.title });
  return { title: page.title, url: `${origin(res)}${page.path}`, body };
};

export const home = async (_req: Request, res: Response) => {
  sendPage(res, await markdownService.homeMarkdown(origin(res)));
};

export const product = async (req: Request, res: Response) => {
  sendPage(res, await markdownService.productMarkdown(String(req.params[0]), origin(res)));
};

export const article = async (req: Request, res: Response) => {
  sendPage(res, await markdownService.articleMarkdown(String(req.params[0]), origin(res)));
};

export const contentPage = async (req: Request, res: Response) => {
  const page = CONTENT_PAGES.find((p) => p.path === `/${req.params[0]}`);
  if (!page) return notFound(res);
  sendPage(res, await contentPageMarkdown(res, page));
};

export const llms = async (_req: Request, res: Response) => {
  sendText(res, await markdownService.llmsTxt(origin(res)), "plain");
};

export const llmsFull = async (_req: Request, res: Response) => {
  const contentPages = [];
  for (const page of CONTENT_PAGES) contentPages.push(await contentPageMarkdown(res, page));
  sendText(res, await markdownService.llmsFullTxt(origin(res), contentPages), "plain");
};

export const productList = async (req: Request, res: Response) => {
  sendPage(res, await markdownService.productListMarkdown(req.params[0] ? String(req.params[0]) : undefined, origin(res)));
};

export const articleList = async (req: Request, res: Response) => {
  sendPage(res, await markdownService.articleListMarkdown(req.params[0] ? String(req.params[0]) : undefined, origin(res)));
};

export const contact = async (_req: Request, res: Response) => {
  sendPage(res, await markdownService.contactMarkdown(origin(res), res.locals.storeContact || {}));
};
