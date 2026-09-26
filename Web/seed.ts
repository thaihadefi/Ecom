#!/usr/bin/env ts-node
/**
 * Database Seed Script — `npm run db:seed`
 *
 * Creates the minimum data needed to start using a fresh Ecom instance:
 * 1. A "Super Admin" role with all permissions
 * 2. A super-admin account (admin@ecom.local / Admin@123), only when the database has no admin yet
 * 3. Default site settings (general, storefront, payment, shipping placeholders)
 *
 * Safe to run multiple times: existing records are kept, and settings only gain the fields
 * they are missing (a saved value is never overwritten).
 */

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import AccountAdmin from "./models/account-admin.model";
import Role from "./models/role.model";
import Setting from "./models/setting.model";
import { permissionList } from "./configs/variable.config";
import { STOREFRONT_DEFAULTS } from "./configs/storefront.config";
import { SHIPPING_CONFIG } from "./configs/shipping.config";
import {
  ISettingApiAppPassword,
  ISettingApiLoginSocial,
  ISettingApiPayment,
  ISettingApiShipping,
  ISettingGeneral
} from "./interfaces/models/setting.interface";

const SEED_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "admin@ecom.local";
const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "Admin@123";
const SEED_ADMIN_NAME = process.env.SEED_ADMIN_NAME || "Administrator";

const log = (status: string, msg: string) => console.log(`  ${status.padEnd(9)} ${msg}`);

const seedRole = async (): Promise<string> => {
  const existing = await Role.findOne({ name: "Super Admin", deleted: false });
  if (existing) {
    log("skipped", `role "Super Admin" already exists (${existing._id})`);
    return String(existing._id);
  }

  const role = await Role.create({
    name: "Super Admin",
    description: "Full access to all admin features",
    permissions: permissionList.map((p) => p.id),
    status: "active",
    search: "super admin",
  });

  log("created", `role "Super Admin" (${role._id})`);
  return String(role._id);
};

const seedAdmin = async (roleId: string) => {
  const existing = await AccountAdmin.findOne({ email: SEED_ADMIN_EMAIL, deleted: false });
  if (existing) {
    log("skipped", `admin "${SEED_ADMIN_EMAIL}" already exists (${existing._id})`);
    return;
  }

  const hashedPassword = await bcrypt.hash(SEED_ADMIN_PASSWORD, 10);

  await AccountAdmin.create({
    fullName: SEED_ADMIN_NAME,
    email: SEED_ADMIN_EMAIL,
    password: hashedPassword,
    roles: [roleId],
    status: "active",
    isSuperAdmin: true,
    search: `${SEED_ADMIN_NAME} ${SEED_ADMIN_EMAIL}`.toLowerCase(),
  });

  log("created", `admin "${SEED_ADMIN_EMAIL}" with password "${SEED_ADMIN_PASSWORD}"`);
  log("warning", `change this password after the first login`);
};

const seedSettings = async () => {
  // Field names must match interfaces/models/setting.interface.ts, or the app never reads them.
  const general: ISettingGeneral = {
    websiteName: "Ecom Store",
    storeDescription: "Your one-stop destination for quality products delivered fast.",
    domainWebsite: "",
    logo: "",
    favicon: "",
    shopSenderName: "",
    shopSenderPhone: "",
    shopSenderAddress: "",
    contactEmail: "",
    shopLat: "",
    shopLng: "",
  };
  const apiPayment: ISettingApiPayment = {
    vnPayTmnCode: "",
    vnPayHashSecret: "",
    vnPayURL: "",
    zaloPayAppId: "",
    zaloPayKey1: "",
    zaloPayKey2: "",
    zaloPayDomain: "",
  };
  const apiShipping: ISettingApiShipping = {
    defaultItemWeight: SHIPPING_CONFIG.DEFAULT_ITEM_WEIGHT_GRAMS,
    tokenGoShip: "",
    goshipApiUrl: "",
  };
  const apiLoginSocial: ISettingApiLoginSocial = {
    googleClientId: "",
    googleClientSecret: "",
    googleCallbackUrl: "",
    facebookAppId: "",
    facebookAppSecret: "",
    facebookCallbackUrl: "",
  };
  const apiAppPassword: ISettingApiAppPassword = {
    gmailUser: "",
    gmailPassword: "",
  };

  const defaults: Array<{ key: string; label: string; data: object }> = [
    { key: "general", label: "General Settings", data: general },
    { key: "storefront", label: "Storefront", data: STOREFRONT_DEFAULTS },
    { key: "apiPayment", label: "Payment Gateway API", data: apiPayment },
    { key: "apiShipping", label: "Shipping", data: apiShipping },
    { key: "apiLoginSocial", label: "Social Login API", data: apiLoginSocial },
    { key: "apiAppPassword", label: "App API Password", data: apiAppPassword },
  ];

  for (const { key, label, data } of defaults) {
    const exists = await Setting.findOne({ key }).lean();
    if (!exists) {
      await Setting.create({ key, data });
      log("created", `setting "${label}"`);
      continue;
    }

    // Fill fields added in newer versions; a value the store already saved is never changed.
    const saved = (exists.data || {}) as Record<string, unknown>;
    const missing = Object.entries(data).filter(([field]) => saved[field] === undefined);
    if (missing.length === 0) {
      log("skipped", `setting "${label}" is up to date`);
      continue;
    }
    await Setting.updateOne({ key }, { $set: Object.fromEntries(missing.map(([field, value]) => [`data.${field}`, value])) });
    log("updated", `setting "${label}": added ${missing.map(([field]) => field).join(", ")}`);
  }
};

const main = async () => {
  console.log("\nEcom database seed\n");

  const dbUri = process.env.DATABASE;
  if (!dbUri) {
    console.error("DATABASE env var is missing. Copy .env.example to .env first.");
    process.exit(1);
  }

  await mongoose.connect(dbUri);
  log("connected", `${dbUri.replace(/\/\/[^@]+@/, "//***@")}`);

  // The default super admin (with its well-known password) is only for a brand-new database;
  // a store that already has staff accounts keeps managing them itself.
  const adminCount = await AccountAdmin.countDocuments({ deleted: false });
  if (adminCount === 0) {
    console.log("\n  --- Roles ---");
    const roleId = await seedRole();

    console.log("\n  --- Admin Account ---");
    await seedAdmin(roleId);
  } else {
    log("skipped", `${adminCount} admin account(s) already exist; no default admin created`);
  }

  console.log("\n  --- Settings ---");
  await seedSettings();

  await mongoose.disconnect();
  console.log("\nSeed completed.\n");
};

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
