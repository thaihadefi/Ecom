import Product from '../../models/product.model';
import AttributeProduct from '../../models/attribute-product.model';
import { IProduct } from '../../interfaces/models/product.interface';
import { IAttributeProduct } from '../../interfaces/models/attribute-product.interface';

export interface IWishlistItemInput {
  productId: string;
}

export interface IWishlistDetailItem extends IWishlistItemInput {
  detail: {
    images?: string[];
    slug?: string;
    name?: string;
    priceNew?: number;
    priceOld?: number;
    stock?: number;
    attributeList: IAttributeProduct[];
    variants?: unknown[];
  };
}

export const getWishlistDetailList = async (wishlist: IWishlistItemInput[]): Promise<IWishlistDetailItem[]> => {
  const wishlistDetail: IWishlistDetailItem[] = [];

  const productIds = wishlist.map((i) => i.productId);
  const products: IProduct[] = await Product.find({
    _id: { $in: productIds },
    deleted: false,
    status: "active"
  }).select("_id slug name priceNew priceOld stock images attributes variants");
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  const allAttrIds = products.flatMap((p) => (p.attributes || []).map(String));
  const attrList: IAttributeProduct[] = await AttributeProduct.find({ _id: { $in: allAttrIds } }).select("_id name");
  const attrMap = new Map(attrList.map((a) => [String(a._id), a]));

  for (const item of wishlist) {
    const productDetail = productMap.get(String(item.productId));
    if (productDetail) {
      const attributeList = (productDetail.attributes || []).map((id) => attrMap.get(String(id))).filter(Boolean) as IAttributeProduct[];
      wishlistDetail.push({
        ...item,
        detail: {
          images: productDetail.images,
          slug: productDetail.slug,
          name: productDetail.name,
          priceNew: productDetail.priceNew,
          priceOld: productDetail.priceOld,
          stock: productDetail.stock,
          attributeList,
          variants: productDetail.variants
        }
      });
    }
  }

  return wishlistDetail;
};
