// Atlas Search index definitions, applied by `yarn db:search-index`.
// `name` is mapped twice: as text for whole words and typos, and as autocomplete for search-as-you-type.
// atlas-search.helper.ts queries the first search path as that autocomplete-mapped title.

const storeTextAnalyzer = {
  name: "storeText",
  // Descriptions are HTML; strip tags so "strong" or "span" never match. icuFolding makes "ao dai" match "áo dài".
  charFilters: [{ type: "htmlStrip" }],
  tokenizer: { type: "standard" },
  tokenFilters: [{ type: "icuFolding" }]
};

const titleField = [
  { type: "string" },
  { type: "autocomplete", tokenization: "edgeGram", minGrams: 2, maxGrams: 15, foldDiacritics: true }
];

const buildDefinition = (textFields: string[]) => ({
  analyzer: "storeText",
  searchAnalyzer: "storeText",
  analyzers: [storeTextAnalyzer],
  mappings: {
    dynamic: false,
    fields: {
      name: titleField,
      ...Object.fromEntries(textFields.map((field) => [field, { type: "string" }]))
    }
  }
});

export const SEARCH_INDEX_DEFINITIONS: Record<string, ReturnType<typeof buildDefinition>> = {
  products: buildDefinition(["description"]),
  blogs: buildDefinition(["description", "content"])
};
