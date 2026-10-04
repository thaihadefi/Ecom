import TurndownService from "turndown";
import Product from "../../models/product.model";
import Blog from "../../models/blog.model";
import CategoryProduct from "../../models/category-product.model";
import CategoryBlog from "../../models/category-blog.model";
import { FEATURES } from "../../configs/features.config";
import { getGeneral, getCachedSetting } from "../../configs/setting.config";
import { CONTENT_PAGES, ContentPageKey } from "../../configs/content-pages.config";
import { getProductDetailBySlug } from "./product.service";
import { getArticleDetail } from "./article.service";
import { safeHtml } from "../../helpers/html-sanitize.helper";
import { absoluteUrl, plainText } from "../../helpers/seo.helper";
import { storeName } from "../../helpers/structured-data.helper";
import { formatPrice } from "../../helpers/format.helper";
import { getStorefront } from "../../configs/storefront.config";

// Markdown twins of public pages (/path.md), llms.txt and llms-full.txt, built from the same
// records the HTML pages render, for AI assistants and agents that read Markdown.

const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced", bulletListMarker: "-" });
// Input is already sanitized (safeHtml); embedded players have no Markdown form.
turndown.remove(["iframe", "video", "audio"]);

// Root-relative links and images become absolute so the Markdown works outside the site.
export const htmlToMarkdown = (html: string | undefined, origin: string): string => {
  const clean = safeHtml(html);
  if (!clean) return "";
  return turndown.turndown(clean.replace(/(src|href)="\/(?!\/)/g, `$1="${origin}/`)).trim();
};

export type MarkdownPage = { title: string; url: string; updated?: Date; body: string };

export const renderMarkdownPage = (page: MarkdownPage): string => {
  const header = [`# ${page.title}`, "", `URL: ${page.url}`];
  if (page.updated) header.push(`Last updated: ${page.updated.toISOString().slice(0, 10)}`);
  return `${header.join("\n")}\n\n${page.body.trim()}\n`;
};

const listActiveProducts = (categoryId?: string) =>
  Product.find({ deleted: false, status: "active", "seo.robots.index": { $ne: false }, ...(categoryId ? { category: categoryId } : {}) })
    .sort({ position: -1, createdAt: -1 })
    .select("name slug priceNew description updatedAt");

const listPublishedArticles = (categoryId?: string) =>
  FEATURES.BLOG
    ? Blog.find({ deleted: false, status: "published", "seo.robots.index": { $ne: false }, ...(categoryId ? { category: categoryId } : {}) })
      .sort({ publishAt: -1 })
      .select("name slug description updatedAt")
    : Promise.resolve([]);

const productLine = (p: { name?: string; slug?: string; priceNew?: number; description?: string }, origin: string) =>
  `- [${p.name}](${origin}/product/detail/${encodeURIComponent(String(p.slug))}.md): ${formatPrice(p.priceNew || 0)}. ${plainText(p.description, 120)}`.trim();

const articleLine = (a: { name?: string; slug?: string; description?: string }, origin: string) =>
  `- [${a.name}](${origin}/article/detail/${encodeURIComponent(String(a.slug))}.md): ${plainText(a.description, 120)}`.trim();

// Product catalog, whole or one category (/product.md, /product/category/<slug>.md).
export const productListMarkdown = async (slug: string | undefined, origin: string): Promise<MarkdownPage | null> => {
  const category = slug ? await CategoryProduct.findOne({ slug, deleted: false, status: "active" }).select("name slug updatedAt") : null;
  if (slug && !category) return null;
  const products = await listActiveProducts(category ? String(category._id) : undefined);
  return {
    title: category ? String(category.name) : "All Products",
    url: `${origin}/product${category ? `/category/${encodeURIComponent(String(category.slug))}` : ""}`,
    body: products.length ? products.map((p) => productLine(p, origin)).join("\n") : "No products yet.",
  };
};

// Article list, whole or one category (/article.md, /article/category/<slug>.md).
export const articleListMarkdown = async (slug: string | undefined, origin: string): Promise<MarkdownPage | null> => {
  if (!FEATURES.BLOG) return null;
  const category = slug ? await CategoryBlog.findOne({ slug, deleted: false, status: "active" }).select("name slug") : null;
  if (slug && !category) return null;
  const articles = await listPublishedArticles(category ? String(category._id) : undefined);
  return {
    title: category ? String(category.name) : "Articles",
    url: `${origin}/article${category ? `/category/${encodeURIComponent(String(category.slug))}` : ""}`,
    body: articles.length ? articles.map((a) => articleLine(a, origin)).join("\n") : "No articles yet.",
  };
};

export const contactMarkdown = async (origin: string, contact: { phone?: string; email?: string; address?: string; mapUrl?: string }): Promise<MarkdownPage> => {
  const general = await getGeneral();
  const lines = [`Contact ${storeName(general)} through the form on the contact page or the details below.`, ""];
  if (contact.phone) lines.push(`- Phone: ${contact.phone}`);
  if (contact.email) lines.push(`- Email: ${contact.email}`);
  if (contact.address) lines.push(`- Address: ${contact.address}`);
  if (contact.mapUrl) lines.push(`- Map: ${contact.mapUrl}`);
  return { title: "Contact Us", url: `${origin}/contact`, body: lines.join("\n") };
};

export const productMarkdown = async (slug: string, origin: string): Promise<MarkdownPage | null> => {
  const data = await getProductDetailBySlug(slug);
  if (!data) return null;
  const product = data.productDetail;
  const url = `${origin}/product/detail/${encodeURIComponent(String(product.slug))}`;

  const facts = [
    `- Price: ${formatPrice(product.priceNew || 0)}${product.priceOld && product.priceOld > (product.priceNew || 0) ? ` (was ${formatPrice(product.priceOld)})` : ""}`,
    `- Availability: ${(product.stock || 0) > 0 ? `In stock (${product.stock})` : "Out of stock"}`,
  ];
  if (product.sku) facts.push(`- SKU: ${product.sku}`);
  const categories = (product.categoryList || []).filter((c) => c.name);
  if (categories.length) facts.push(`- Category: ${categories.map((c) => `[${c.name}](${origin}/product/category/${encodeURIComponent(String(c.slug))}.md)`).join(", ")}`);
  if (FEATURES.REVIEWS && product.ratingCount > 0) facts.push(`- Rating: ${product.ratingAvg} out of 5 from ${product.ratingCount} reviews`);
  for (const attribute of data.attributeList || []) {
    const values = attribute.variantsLabel?.length ? attribute.variantsLabel : attribute.variants || [];
    if (values.length) facts.push(`- ${attribute.name}: ${values.join(", ")}`);
  }

  const images = (product.images || []).map((img, i) => `![${product.name} image ${i + 1}](${absoluteUrl(origin, img)})`);
  const body = [
    facts.join("\n"),
    htmlToMarkdown(product.description, origin),
    product.content ? `## Details\n\n${htmlToMarkdown(product.content, origin)}` : "",
    images.length ? `## Images\n\n${images.join("\n")}` : "",
  ].filter(Boolean).join("\n\n");

  return { title: product.name || "", url, updated: product.updatedAt, body };
};

export const articleMarkdown = async (slug: string, origin: string): Promise<MarkdownPage | null> => {
  if (!FEATURES.BLOG) return null;
  const article = await getArticleDetail(slug);
  if (!article) return null;
  const url = `${origin}/article/detail/${encodeURIComponent(String(article.slug))}`;
  const byline = [
    article.publishAt ? `Published: ${new Date(article.publishAt).toISOString().slice(0, 10)}` : "",
    article.authorName ? `Author: ${article.authorName}` : "",
  ].filter(Boolean).join("\n");
  const body = [
    byline,
    article.avatar ? `![${article.name}](${absoluteUrl(origin, article.avatar)})` : "",
    htmlToMarkdown(article.description, origin),
    htmlToMarkdown(article.content, origin),
  ].filter(Boolean).join("\n\n");
  return { title: article.name || "", url, updated: article.updatedAt, body };
};

// Saved text from Settings > Page Content; null when the page still shows its default view.
export const savedContentPageHtml = async (key: ContentPageKey): Promise<string> => {
  const saved = (await getCachedSetting<Partial<Record<ContentPageKey, string>>>("pages"))[key];
  return safeHtml(saved);
};

export const homeMarkdown = async (origin: string): Promise<MarkdownPage> => {
  const general = await getGeneral();
  const name = storeName(general);
  const [products, articles, categories] = await Promise.all([
    listActiveProducts(),
    listPublishedArticles(),
    CategoryProduct.find({ deleted: false, status: "active" }).select("name slug"),
  ]);

  const sections: string[] = [];
  if (general?.storeDescription) sections.push(general.storeDescription);
  sections.push(`Prices are in ${getStorefront().currency}.`);
  if (categories.length) {
    sections.push(`## Categories\n\n${categories.map((c) => `- [${c.name}](${origin}/product/category/${encodeURIComponent(String(c.slug))}.md)`).join("\n")}`);
  }
  if (products.length) {
    sections.push(`## Products\n\n${products.map((p) => `- [${p.name}](${origin}/product/detail/${encodeURIComponent(String(p.slug))}.md): ${formatPrice(p.priceNew || 0)}`).join("\n")}`);
  }
  if (articles.length) {
    sections.push(`## Articles\n\n${articles.map((a) => `- [${a.name}](${origin}/article/detail/${encodeURIComponent(String(a.slug))}.md)`).join("\n")}`);
  }
  sections.push(`## Store pages\n\n${CONTENT_PAGES.map((p) => `- [${p.title}](${origin}${p.path}.md)`).concat(`- [Contact](${origin}/contact.md)`).join("\n")}`);

  return { title: name, url: `${origin}/`, body: sections.join("\n\n") };
};

export const llmsTxt = async (origin: string): Promise<string> => {
  const general = await getGeneral();
  const name = storeName(general);
  const [products, articles] = await Promise.all([listActiveProducts(), listPublishedArticles()]);

  const lines = [
    `# ${name}`,
    "",
    `> ${general?.storeDescription || `${name} online store.`}`,
    "",
    `Every page below is the Markdown version of a public page on ${origin}. Prices are in ${getStorefront().currency}. Customers order on the website; the full text of all pages is at ${origin}/llms-full.txt.`,
    "",
    "## Store",
    "",
    `- [Home](${origin}/index.md): categories, products and articles`,
    `- [All products](${origin}/product.md)`,
    `- [Contact](${origin}/contact.md)`,
    ...CONTENT_PAGES.map((p) => `- [${p.title}](${origin}${p.path}.md)`),
  ];
  if (products.length) {
    lines.push("", "## Products", "");
    lines.push(...products.map((p) => productLine(p, origin)));
  }
  if (articles.length) {
    lines.push("", "## Articles", "");
    lines.push(...articles.map((a) => articleLine(a, origin)));
  }
  return `${lines.join("\n")}\n`;
};

export const llmsFullTxt = async (origin: string, contentPages: MarkdownPage[]): Promise<string> => {
  const [products, articles] = await Promise.all([listActiveProducts(), listPublishedArticles()]);
  const pages: Array<MarkdownPage | null> = [await homeMarkdown(origin)];
  for (const p of products) pages.push(await productMarkdown(String(p.slug), origin));
  for (const a of articles) pages.push(await articleMarkdown(String(a.slug), origin));
  pages.push(...contentPages);
  return pages.filter((p): p is MarkdownPage => !!p).map(renderMarkdownPage).join("\n---\n\n");
};
