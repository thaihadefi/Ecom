import { ISettingGeneral } from "../interfaces/models/setting.interface";
import { IProduct } from "../interfaces/models/product.interface";
import { IBlog } from "../interfaces/models/blog.interface";
import { SOCIAL_LINKS } from "../configs/social-links.config";
import { getStorefront } from "../configs/storefront.config";
import { FEATURES } from "../configs/features.config";
import { absoluteUrl, plainText } from "./seo.helper";

// schema.org JSON-LD built from the same data the page shows. Rendered by the client layout.
type JsonLd = Record<string, unknown>;

export const storeName = (general: ISettingGeneral | undefined): string =>
  (general?.websiteName || "").trim() || "Ecom Store";

export const siteJsonLd = (general: ISettingGeneral | undefined, origin: string): JsonLd[] => {
  const name = storeName(general);
  const sameAs = SOCIAL_LINKS.map((s) => general?.[s.key]).filter((url): url is string => !!url && /^https?:\/\//.test(url));
  const organization: JsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${origin}/#organization`,
    name,
    url: `${origin}/`,
  };
  if (general?.logo) organization.logo = absoluteUrl(origin, general.logo);
  if (general?.storeDescription) organization.description = general.storeDescription;
  if (general?.contactEmail) organization.email = general.contactEmail;
  if (general?.shopSenderPhone) organization.telephone = general.shopSenderPhone;
  if (sameAs.length) organization.sameAs = sameAs;

  const website: JsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${origin}/#website`,
    name,
    url: `${origin}/`,
    publisher: { "@id": `${origin}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${origin}/search?keyword={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
  return [organization, website];
};

export const breadcrumbJsonLd = (items: Array<{ name: string; url: string }>): JsonLd => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: item.url })),
});

export const productJsonLd = (product: IProduct, origin: string, url: string): JsonLd[] => {
  const category = product.categoryList?.[0];
  const data: JsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    url,
    image: (product.images || []).map((img) => absoluteUrl(origin, img)),
    description: plainText(product.description || product.content, 500),
    brand: { "@id": `${origin}/#organization` },
    offers: {
      "@type": "Offer",
      url,
      price: product.priceNew || 0,
      priceCurrency: getStorefront().currency,
      availability: (product.stock || 0) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@id": `${origin}/#organization` },
    },
  };
  if (product.sku) data.sku = product.sku;
  if (category?.name) data.category = category.name;
  if (FEATURES.REVIEWS && product.ratingCount > 0) {
    data.aggregateRating = { "@type": "AggregateRating", ratingValue: product.ratingAvg, reviewCount: product.ratingCount, bestRating: 5, worstRating: 1 };
  }

  const trail = [{ name: "Home", url: `${origin}/` }];
  if (category?.name && category.slug) trail.push({ name: category.name, url: `${origin}/product/category/${category.slug}` });
  trail.push({ name: product.name || "", url });
  return [data, breadcrumbJsonLd(trail)];
};

export const articleJsonLd = (article: IBlog, origin: string, url: string): JsonLd[] => {
  const data: JsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.name,
    url,
    mainEntityOfPage: url,
    description: plainText(article.description || article.content, 300),
    datePublished: new Date(article.publishAt || article.createdAt).toISOString(),
    dateModified: new Date(article.updatedAt).toISOString(),
    publisher: { "@id": `${origin}/#organization` },
  };
  if (article.avatar) data.image = absoluteUrl(origin, article.avatar);
  if (article.authorName) data.author = { "@type": "Person", name: article.authorName };
  return [data, breadcrumbJsonLd([
    { name: "Home", url: `${origin}/` },
    { name: "Articles", url: `${origin}/article` },
    { name: article.name || "", url },
  ])];
};
