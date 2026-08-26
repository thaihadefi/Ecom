import Product from '../../models/product.model';
import AttributeProduct from '../../models/attribute-product.model';
import { IProduct } from '../../interfaces/models/product.interface';
import { IAttributeProduct } from '../../interfaces/models/attribute-product.interface';

export interface ICompareItemInput {
  productId: string;
}

export interface ICompareDetailItem extends ICompareItemInput {
  detail: {
    images?: string[];
    slug?: string;
    name?: string;
    description?: string;
    priceNew?: number;
    priceOld?: number;
    stock?: number;
    attributeList: IAttributeProduct[];
    variants?: unknown[];
  };
}

export const getCompareDetailList = async (compareList: ICompareItemInput[]): Promise<ICompareDetailItem[]> => {
  const compareDetail: ICompareDetailItem[] = [];

  const productIds = compareList.map((i) => i.productId);
  const products: IProduct[] = await Product.find({
    _id: { $in: productIds },
    deleted: false,
    status: "active"
  }).select("_id slug name description priceNew priceOld stock images attributes variants");
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  const allAttrIds = products.flatMap((p) => (p.attributes || []).map(String));
  const attrList: IAttributeProduct[] = await AttributeProduct.find({ _id: { $in: allAttrIds } }).select("_id name");
  const attrMap = new Map(attrList.map((a) => [String(a._id), a]));

  for (const item of compareList) {
    const productDetail = productMap.get(String(item.productId));
    if (productDetail) {
      const attributeList = (productDetail.attributes || []).map((id) => attrMap.get(String(id))).filter(Boolean) as IAttributeProduct[];
      compareDetail.push({
        ...item,
        detail: {
          images: productDetail.images,
          slug: productDetail.slug,
          name: productDetail.name,
          description: productDetail.description,
          priceNew: productDetail.priceNew,
          priceOld: productDetail.priceOld,
          stock: productDetail.stock,
          attributeList,
          variants: productDetail.variants
        }
      });
    }
  }

  return compareDetail;
};
