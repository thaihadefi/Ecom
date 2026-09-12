// Seeds fake accounts + order history for CF/forecasting/anomaly-detection demo data.
// Purely additive; seeded documents are tagged for removal via scripts/unseed-demo-data.ts.
// Usage: yarn seed:demo

import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectDB } from "../configs/database.config";
import { generateRandomString, generateRandomNumber, shuffleArray } from "../helpers/generate.helper";
import AccountUser from "../models/account-user.model";
import Product from "../models/product.model";
import Order from "../models/order.model";
import { recomputeProductRecommendations } from "../services/admin/recommendation.service";
import { trainAnomalyModel, scoreOrderForAnomaly } from "../services/admin/anomaly-detection.service";

const NUM_REGULAR_ACCOUNTS = 25;
const NUM_BOT_IDENTITIES = 5;
const NUM_NORMAL_ORDERS = 220;
const LOOKBACK_DAYS = 60;
const RECENT_DAYS_FOR_BOTS = 7;

const SEED_EMAIL_PREFIX = "seed.";
const SEED_ORDER_CODE_PREFIX = "SEED-";

const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat = (min: number, max: number) => Math.random() * (max - min) + min;
const pick = <T>(arr: T[]): T => arr[randomInt(0, arr.length - 1)];

const daysAgo = (days: number): Date => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
const minutesBefore = (date: Date, minutes: number): Date => new Date(date.getTime() - minutes * 60000);

interface SeedProduct {
  _id: string;
  name: string;
  image?: string;
  price: number;
}

const priceOf = (product: {
  priceNew?: number;
  variants?: { status?: boolean; priceNew?: number; price?: number }[];
}): number => {
  const activeVariant = (product.variants || []).find((v) => v.status !== false && (v.priceNew || v.price));
  if (activeVariant) return activeVariant.priceNew || activeVariant.price || 0;
  return product.priceNew || 50000;
};

interface SeedOrderPlan {
  createdAt: Date;
  userId?: string;
  fullName: string;
  phone: string;
  items: { productId: string; quantity: number; price: number; name: string; image?: string }[];
  discount: number;
  coupon?: string;
  paymentMethod: "money" | "vnpay" | "zalopay";
  orderStatus: "pending" | "confirmed" | "shipping" | "completed" | "cancelled";
}

const buildOrderDoc = (plan: SeedOrderPlan) => {
  const subTotal = plan.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shippingFee = randomInt(20000, 40000);
  const total = Math.max(0, subTotal + shippingFee - plan.discount);

  return {
    userId: plan.userId,
    code: `${SEED_ORDER_CODE_PREFIX}${generateRandomString(4).toUpperCase()}${generateRandomNumber(4)}`,
    fullName: plan.fullName,
    phone: plan.phone,
    address: "123 Demo Street, District 1, Ho Chi Minh City",
    note: "",
    items: plan.items,
    subTotal,
    coupon: plan.coupon,
    discount: plan.discount,
    total,
    paymentMethod: plan.paymentMethod,
    paymentStatus: "paid" as const,
    orderStatus: plan.orderStatus,
    shipping: { fee: shippingFee },
    deleted: false
  };
};

const run = async () => {
  dotenv.config();
  await connectDB();

  const products = await Product.find({ deleted: false, status: "active" })
    .select("_id name images priceNew variants")
    .limit(80);

  if (products.length < 6) {
    console.error(`Only ${products.length} active products found. Create at least 6 products before seeding demo orders.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const seedProducts: SeedProduct[] = products.map((p) => ({
    _id: String(p._id),
    name: p.name || "Product",
    image: p.images?.[0],
    price: priceOf(p)
  }));

  // Chunk products into affinity clusters so orders naturally co-purchase within a cluster.
  const clusterSize = 3;
  const clusters: SeedProduct[][] = [];
  for (let i = 0; i < seedProducts.length; i += clusterSize) {
    clusters.push(seedProducts.slice(i, i + clusterSize));
  }

  console.log(`Found ${seedProducts.length} products in ${clusters.length} clusters.`);

  const seedPasswordHash = await bcrypt.hash("SeedDemo123!", 10);

  // Regular (normal-behavior) accounts, aged 30-400 days
  const regularAccountsRaw = Array.from({ length: NUM_REGULAR_ACCOUNTS }, (_, i) => ({
    fullName: `Seed Customer ${i + 1}`,
    email: `${SEED_EMAIL_PREFIX}customer${i + 1}@seed.demo`,
    phone: `09${generateRandomNumber(8)}`,
    password: seedPasswordHash,
    status: "active" as const
  }));
  const insertedRegularAccounts = await AccountUser.insertMany(regularAccountsRaw);
  const regularAccountAges = insertedRegularAccounts.map(() => randomFloat(30, 400));
  await AccountUser.collection.bulkWrite(
    insertedRegularAccounts.map((acc, idx) => ({
      updateOne: {
        filter: { _id: acc._id },
        update: { $set: { createdAt: daysAgo(regularAccountAges[idx]), updatedAt: daysAgo(regularAccountAges[idx]) } }
      }
    }))
  );
  console.log(`Created ${insertedRegularAccounts.length} regular seed accounts.`);

  // Bot identities: brand-new accounts used for rapid-fire flash-sale bursts
  const botAccountsRaw = Array.from({ length: NUM_BOT_IDENTITIES }, (_, i) => ({
    fullName: `Seed Bot ${i + 1}`,
    email: `${SEED_EMAIL_PREFIX}bot${i + 1}@seed.demo`,
    phone: `08${generateRandomNumber(8)}`,
    password: seedPasswordHash,
    status: "active" as const
  }));
  const insertedBotAccounts = await AccountUser.insertMany(botAccountsRaw);
  console.log(`Created ${insertedBotAccounts.length} bot seed accounts.`);

  // Normal orders spread across the lookback window
  const normalOrderPlans: SeedOrderPlan[] = [];
  for (let i = 0; i < NUM_NORMAL_ORDERS; i++) {
    const isGuest = Math.random() < 0.25;
    const account = isGuest ? undefined : pick(insertedRegularAccounts);
    const cluster = pick(clusters);
    const itemCount = randomInt(1, Math.min(3, cluster.length));
    const chosenProducts = shuffleArray(cluster).slice(0, itemCount);

    if (Math.random() < 0.15) chosenProducts.push(pick(seedProducts));

    const items = chosenProducts.map((p) => ({
      productId: p._id,
      quantity: randomInt(1, 2),
      price: p.price,
      name: p.name,
      image: p.image
    }));

    const subTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const hasDiscount = Math.random() < 0.3;
    const discount = hasDiscount ? Math.round(subTotal * randomFloat(0.05, 0.15)) : 0;

    const statusRoll = Math.random();
    const orderStatus =
      statusRoll < 0.5 ? "completed" : statusRoll < 0.85 ? "confirmed" : statusRoll < 0.95 ? "shipping" : "cancelled";

    normalOrderPlans.push({
      createdAt: daysAgo(randomFloat(0, LOOKBACK_DAYS)),
      userId: account ? String(account._id) : undefined,
      fullName: account?.fullName || "Guest Customer",
      phone: account?.phone || `07${generateRandomNumber(8)}`,
      items,
      discount,
      coupon: hasDiscount ? "WELCOME10" : undefined,
      paymentMethod: pick(["money", "vnpay", "zalopay"]),
      orderStatus
    });
  }

  // Bot bursts: same identity firing several orders within minutes, brand-new account, heavy discount.
  const botOrderPlans: SeedOrderPlan[] = [];
  const botAccountAges: Date[] = insertedBotAccounts.map(() => new Date());
  insertedBotAccounts.forEach((account, idx) => {
    const burstStart = daysAgo(randomFloat(0, RECENT_DAYS_FOR_BOTS));
    botAccountAges[idx] = minutesBefore(burstStart, randomFloat(2, 5));

    const targetProduct = pick(clusters[idx % clusters.length]);
    const burstCount = randomInt(5, 8);

    for (let k = 0; k < burstCount; k++) {
      const orderTime = new Date(burstStart.getTime() + k * randomInt(20, 70) * 1000);
      const quantity = randomInt(1, 3);
      const subTotal = targetProduct.price * quantity;
      const discount = Math.round(subTotal * 0.5);

      botOrderPlans.push({
        createdAt: orderTime,
        userId: String(account._id),
        fullName: account.fullName || "Seed Bot",
        phone: account.phone || `08${generateRandomNumber(8)}`,
        items: [{ productId: targetProduct._id, quantity, price: targetProduct.price, name: targetProduct.name, image: targetProduct.image }],
        discount,
        coupon: "FLASHSALE50",
        paymentMethod: "vnpay",
        orderStatus: "confirmed"
      });
    }
  });

  await AccountUser.collection.bulkWrite(
    insertedBotAccounts.map((account, idx) => ({
      updateOne: {
        filter: { _id: account._id },
        update: { $set: { createdAt: botAccountAges[idx], updatedAt: botAccountAges[idx] } }
      }
    }))
  );

  const allPlans = [...normalOrderPlans, ...botOrderPlans];
  const orderDocs = allPlans.map(buildOrderDoc);
  const insertedOrders = await Order.insertMany(orderDocs, { ordered: false });

  await Order.collection.bulkWrite(
    insertedOrders.map((order, idx) => ({
      updateOne: {
        filter: { _id: order._id },
        update: { $set: { createdAt: allPlans[idx].createdAt, updatedAt: allPlans[idx].createdAt } }
      }
    }))
  );

  console.log(`Inserted ${normalOrderPlans.length} normal orders and ${botOrderPlans.length} bot-burst orders.`);

  // Compute immediately so the demo doesn't need to wait for cron.
  const cfResult = await recomputeProductRecommendations();
  console.log(`CF recommendations: updated ${cfResult.productsUpdated} products from ${cfResult.ordersScanned} orders.`);

  const anomalyResult = await trainAnomalyModel();
  console.log(`Isolation Forest: trained=${anomalyResult.trained} on ${anomalyResult.ordersUsed} orders.`);

  if (anomalyResult.trained) {
    const SCORING_BATCH_SIZE = 20;
    for (let i = 0; i < insertedOrders.length; i += SCORING_BATCH_SIZE) {
      const batch = insertedOrders.slice(i, i + SCORING_BATCH_SIZE);
      await Promise.all(batch.map((order) => scoreOrderForAnomaly(String(order._id))));
    }
    const flaggedCount = await Order.countDocuments({ isAnomalous: true, deleted: false });
    console.log(`Flagged ${flaggedCount} orders as anomalous out of all orders in the DB.`);
  }

  console.log("\nDone. Note: this script trained its own in-process model.");
  console.log("Click \"Retrain Model\" on /admin/order/flagged (or restart the dev server) so the LIVE server picks up this seeded history for scoring future orders.");
  console.log(`Login for seeded customers using *@seed.demo email, password "SeedDemo123!".`);

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((error) => {
  console.error("Seed script failed:", error);
  process.exit(1);
});
