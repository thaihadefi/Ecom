import slugify from "slugify";

export const toSearchText = (text: string): string =>
  slugify(text, { replacement: " ", lower: true });

export const toSlug = (text: string): string =>
  slugify(text, { lower: true, strict: true });
