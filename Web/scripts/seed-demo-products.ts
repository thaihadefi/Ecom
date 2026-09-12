// Adds demo products for scripts/seed-demo-data.ts, reusing real categories/images.
// Tagged "seed-demo" for removal by scripts/unseed-demo-data.ts.
// Usage: yarn seed:demo:products

import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDB } from "../configs/database.config";
import { toSlug, toSearchText } from "../helpers/slugify.helper";
import { generateRandomString } from "../helpers/generate.helper";
import CategoryProduct from "../models/category-product.model";
import Product from "../models/product.model";
import { invalidateProductCaches, invalidateCategoryProductTree } from "../helpers/metadata-cache.helper";
import { SEED_PRODUCT_TAG } from "./seed-constants";

const PRODUCTS_PER_CATEGORY = 7;

const ADJECTIVES = ["Classic", "Modern", "Vintage", "Elegant", "Casual", "Premium", "Relaxed", "Tailored", "Everyday", "Signature"];
const MEN_ITEMS = ["Shirt", "Jacket", "Trousers", "Sweater", "Coat", "Polo Shirt", "Denim Jeans"];
const WOMEN_ITEMS = ["Blouse", "Dress", "Skirt", "Cardigan", "Jumpsuit", "Trench Coat", "Knit Top"];
const MATERIALS = ["Cotton", "Linen", "Wool", "Silk", "Denim", "Cashmere"];

const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T>(arr: T[]): T => arr[randomInt(0, arr.length - 1)];

const run = async () => {
  dotenv.config();
  await connectDB();

  const categories = await CategoryProduct.find({ deleted: false, status: "active" }).select("_id name");
  if (categories.length === 0) {
    console.error("No active categories found. Create at least one category before seeding demo products.");
    await mongoose.disconnect();
    process.exit(1);
  }

  const existingProducts = await Product.find({ deleted: false }).select("images");
  const imagePool = existingProducts.flatMap((p) => p.images || []);
  if (imagePool.length === 0) {
    console.error("No existing product images found to reuse. Upload at least one real product image first.");
    await mongoose.disconnect();
    process.exit(1);
  }

  const menCategory = categories.find((c) => /men/i.test(c.name || "") && !/women/i.test(c.name || ""));
  const womenCategories = categories.filter((c) => /women/i.test(c.name || ""));

  const productDocs: Record<string, unknown>[] = [];
  const usedSlugs = new Set<string>();

  const addProduct = (name: string, categoryIds: string[]) => {
    let slug = toSlug(name);
    while (usedSlugs.has(slug)) {
      slug = `${toSlug(name)}-${generateRandomString(4)}`;
    }
    usedSlugs.add(slug);

    const priceNew = randomInt(3, 40) * 100000;
    const hasDiscount = Math.random() < 0.3;
    const priceOld = hasDiscount ? Math.round(priceNew * 1.15) : undefined;

    productDocs.push({
      name,
      sku: `SEED-${generateRandomString(6).toUpperCase()}`,
      slug,
      position: 0,
      category: categoryIds,
      images: [pick(imagePool)],
      priceOld,
      priceNew,
      discount: hasDiscount ? Math.round(((priceOld! - priceNew) / priceOld!) * 100) : 0,
      stock: randomInt(3, 60),
      attributes: [],
      variants: [],
      description: `${name} - demo product seeded for the recommendation/forecasting/anomaly-detection demo.`,
      status: "active",
      view: randomInt(0, 500),
      search: toSearchText(name),
      tags: [SEED_PRODUCT_TAG],
      boughtTogether: [],
      deleted: false
    });
  };

  if (menCategory) {
    for (let i = 0; i < PRODUCTS_PER_CATEGORY; i++) {
      const name = `${pick(ADJECTIVES)} ${pick(MATERIALS)} ${pick(MEN_ITEMS)}`;
      addProduct(name, [String(menCategory._id)]);
    }
  }

  if (womenCategories.length > 0) {
    for (let i = 0; i < PRODUCTS_PER_CATEGORY * 2; i++) {
      const name = `${pick(ADJECTIVES)} ${pick(MATERIALS)} ${pick(WOMEN_ITEMS)}`;
      const category = [String(pick(womenCategories)._id)];
      addProduct(name, category);
    }
  }

  if (productDocs.length === 0) {
    console.error("Could not match any Men/Women category by name. Adjust this script's category matching or seed manually.");
    await mongoose.disconnect();
    process.exit(1);
  }

  const inserted = await Product.insertMany(productDocs);
  console.log(`Inserted ${inserted.length} demo products across ${categories.length} categories.`);

  invalidateProductCaches();
  invalidateCategoryProductTree();

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((error) => {
  console.error("Seed demo products failed:", error);
  process.exit(1);
});
