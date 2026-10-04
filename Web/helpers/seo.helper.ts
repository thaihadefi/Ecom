import sanitizeHtml from "sanitize-html";
import { mediaBase } from "../configs/variable.config";
import { IProductSeoInput } from "../interfaces/models/product.interface";
import { ISeo } from "../interfaces/models/seo.interface";

type SeoDefaults = {
  title?: string;
  keywords: string[];
  image: string;
};

export const buildSeoPayload = (body: IProductSeoInput, defaults: SeoDefaults): ISeo => {
  const title = body.seoTitle || defaults.title || "";
  const description = body.seoDescription || "";

  let keywords: string[] = defaults.keywords;
  if (body.seoKeywords) {
    try {
      keywords = typeof body.seoKeywords === "string" ? JSON.parse(body.seoKeywords) : body.seoKeywords;
    } catch {
      keywords = [String(body.seoKeywords)];
    }
  }

  return {
    title,
    description,
    keywords,
    robots: {
      index: body.seoRobotsIndex === "true",
      follow: body.seoRobotsFollow === "true",
    },
    og: {
      title: body.seoOgTitle || title,
      description: body.seoOgDescription || description,
      image: body.seoOgImage || defaults.image,
    },
  };
};

const decodeBasicEntities = (text: string): string =>
  text.replace(/&quot;/g, "\"").replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

// Rich text reduced to one line of plain text, cut at a word boundary (meta descriptions, JSON-LD).
export const plainText = (html: unknown, maxLength = 160): string => {
  if (typeof html !== "string" || !html) return "";
  const text = decodeBasicEntities(sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })).replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > maxLength * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:]+$/, "")}…`;
};

// Absolute URL for a stored path (media, page path) so crawlers and social cards can fetch it.
export const absoluteUrl = (origin: string, url?: string): string => {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  const full = url.startsWith("/media/") || url.startsWith("media/")
    ? `${mediaBase}${url.startsWith("/") ? "" : "/"}${url}`
    : url;
  if (/^https?:\/\//i.test(full)) return full;
  return `${origin}${full.startsWith("/") ? "" : "/"}${full}`;
};
