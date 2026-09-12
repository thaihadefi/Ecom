// Removes accounts with a "seed." email prefix and orders with a "SEED-" code prefix.
// Usage: yarn seed:demo:undo

import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDB } from "../configs/database.config";
import AccountUser from "../models/account-user.model";
import Order from "../models/order.model";
import Product from "../models/product.model";
import { SEED_PRODUCT_TAG } from "./seed-constants";
import { invalidateProductCaches, invalidateCategoryProductTree } from "../helpers/metadata-cache.helper";

const run = async () => {
  dotenv.config();
  await connectDB();

  const orderResult = await Order.deleteMany({ code: /^SEED-/ });
  const accountResult = await AccountUser.deleteMany({ email: /^seed\./ });
  const productResult = await Product.deleteMany({ tags: SEED_PRODUCT_TAG });

  invalidateProductCaches();
  invalidateCategoryProductTree();

  console.log(`Deleted ${orderResult.deletedCount} seeded orders, ${accountResult.deletedCount} seeded accounts, and ${productResult.deletedCount} seeded products.`);

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((error) => {
  console.error("Unseed script failed:", error);
  process.exit(1);
});
