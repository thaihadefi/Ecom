import { Document, Types } from "mongoose";
import { ISeo } from "./seo.interface";

export interface IProductAttributeValue {
  attrId?: string;
  attrType?: string;
  label: string;
  value: string;
}

export interface IProductVariant {
  status: boolean;
  price?: number;
  priceOld?: number;
  priceNew?: number;
  stock?: number;
  image?: string;
  sku?: string;
  attributeValue: IProductAttributeValue[];
}

export interface IProduct extends Document {
  id?: string;
  name?: string;
  sku?: string;
  slug?: string;
  position?: number;
  category: string[];
  images: string[];
  priceOld?: number;
  priceNew?: number;
  discount: number;
  stock?: number;
  attributes: string[];
  variants: IProductVariant[];
  description?: string;
  content?: string;
  status: "draft" | "active" | "inactive";
  view: number;
  search?: string;
  tags: string[];
  boughtTogether: string[];
  ratingAvg: number;
  ratingCount: number;
  colorList?: string[];
  categoryList?: Array<{ _id: string | Types.ObjectId; name?: string; slug?: string }>;
  deleted: boolean;
  deletedAt?: Date;
  seo?: ISeo;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProductInput {
  name?: string;
  sku?: string;
  slug?: string;
  position?: number | string;
  category?: string | string[];
  images?: string | string[];
  priceOld?: number | string;
  priceNew?: number | string;
  discount?: number | string;
  stock?: number | string;
  attributes?: string | string[] | Array<{ _id: string; name?: string; type?: string }>;
  variants?: string | IProductVariant[];
  tags?: string | string[];
  boughtTogether?: string | string[];
  description?: string;
  content?: string;
  search?: string;
  status?: "draft" | "active" | "inactive";
  seo?: ISeo;
}

export interface IProductSeoInput {
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
  seoRobotsIndex?: string;
  seoRobotsFollow?: string;
  seoOgTitle?: string;
  seoOgDescription?: string;
  seoOgImage?: string;
}
