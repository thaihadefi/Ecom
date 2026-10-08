#!/usr/bin/env ts-node
/**
 * Atlas Search index setup — `yarn db:search-index`
 *
 * Creates or updates the index named by ATLAS_SEARCH_INDEX (default "default") on each collection in
 * configs/search-index.config.ts. Atlas keeps serving the old index while the new one builds.
 * Safe to run multiple times.
 */

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { SEARCH_INDEX_DEFINITIONS } from "./configs/search-index.config";

const INDEX_NAME = process.env.ATLAS_SEARCH_INDEX || "default";

const run = async () => {
  await mongoose.connect(`${process.env.DATABASE}`);
  const db = mongoose.connection.db;
  if (!db) throw new Error("No database connection");

  for (const [collectionName, definition] of Object.entries(SEARCH_INDEX_DEFINITIONS)) {
    const collection = db.collection(collectionName);
    const existing = await collection.listSearchIndexes(INDEX_NAME).toArray();
    if (existing.length > 0) {
      await collection.updateSearchIndex(INDEX_NAME, definition);
      console.log(`  updated   ${collectionName}.${INDEX_NAME}`);
    } else {
      await collection.createSearchIndex({ name: INDEX_NAME, definition });
      console.log(`  created   ${collectionName}.${INDEX_NAME}`);
    }
  }
};

run()
  .catch((error) => {
    console.error("Search index setup failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
