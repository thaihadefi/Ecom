import { toSearchText } from '../../helpers/slugify.helper';
import AttributeProduct from '../../models/attribute-product.model';
import { IAttributeProduct, IAttributeProductInput } from '../../interfaces/models/attribute-product.interface';
import { getTrash } from "../../helpers/admin-crud.helper";
import { paginatedSearch } from "../../helpers/list-query.helper";

export const getActiveAttributes = async (): Promise<IAttributeProduct[]> => {
  return AttributeProduct.find({ deleted: false }).select("_id name type options").sort({ createdAt: "desc" });
};

export const getAttributeProductList = async (rawKeyword?: unknown, rawPage?: unknown) => {
  const { recordList, pagination } = await paginatedSearch(AttributeProduct, rawKeyword, rawPage, { select: "_id name type options" });

  return {
    recordList,
    pagination
  };
};

export const createAttributeProduct = async (data: IAttributeProductInput): Promise<{ success: boolean; message: string; attribute?: IAttributeProduct }> => {
  if (typeof data.options === "string") {
    data.options = JSON.parse(data.options);
  }
  data.search = toSearchText(`${data.name}`);

  const newRecord = new AttributeProduct(data);
  await newRecord.save();

  return { success: true, message: "Attribute created successfully!", attribute: newRecord };
};

export const getAttributeProductById = async (id: string) => {
  return AttributeProduct.findOne({ _id: id, deleted: false });
};

export const updateAttributeProduct = async (id: string, data: IAttributeProductInput): Promise<{ success: boolean; message: string }> => {
  if (typeof data.options === "string") {
    data.options = JSON.parse(data.options);
  }
  data.search = toSearchText(`${data.name}`);

  await AttributeProduct.updateOne({ _id: id, deleted: false }, data);

  return { success: true, message: "Attribute updated successfully!" };
};

export const softDeleteAttributeProduct = async (id: string) => {
  await AttributeProduct.updateOne({ _id: id }, { deleted: true, deletedAt: Date.now() });
  return { success: true, message: "Attribute deleted successfully!" };
};

export const getAttributeProductTrash = () => getTrash(AttributeProduct, "_id name type deletedAt");

export const restoreAttributeProduct = async (id: string) => {
  await AttributeProduct.updateOne({ _id: id }, { deleted: false });
  return { success: true, message: "Restored successfully!" };
};

export const permanentlyDeleteAttributeProduct = async (id: string) => {
  await AttributeProduct.deleteOne({ _id: id });
  return { success: true, message: "Deleted permanently!" };
};
