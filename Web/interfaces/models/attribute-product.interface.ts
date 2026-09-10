import { Document } from "mongoose";

export interface IAttributeOption {
  label?: string;
  value?: string;
}

export interface IAttributeProduct extends Document {
  id?: string;
  name?: string;
  type?: "text" | "select" | "color";
  options: IAttributeOption[];
  variants?: string[];
  variantsLabel?: string[];
  search?: string;
  deleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAttributeProductInput {
  name?: string;
  type?: "text" | "select" | "color";
  options?: string | IAttributeOption[];
  search?: string;
}
