import { IProductSeoInput } from "../interfaces/models/product.interface";
import { ISeo } from "../interfaces/models/seo.interface";

/**
 * Build the stored `seo` sub-document from the flat `seo*` form fields.
 * Products and articles share this shape; each passes the fallbacks that come
 * from its own record (title, keyword list, OG image).
 */
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
