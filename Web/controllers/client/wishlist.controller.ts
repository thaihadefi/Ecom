import { Request, Response } from 'express';
import Product from '../../models/product.model';
import AttributeProduct from '../../models/attribute-product.model';

export const wishlist = (req: Request, res: Response) => {
  res.render("client/pages/wishlist", {
    pageTitle: "Wishlist"
  });
}

export const list = async (req: Request, res: Response) => {
  try {
    const wishlist = req.body;
    const wishlistDetail: any[] = [];

    const productIds = wishlist.map((i: any) => i.productId);
    const products = await Product.find({
      _id: { $in: productIds },
      deleted: false,
      status: "active"
    }).select("_id slug name priceNew priceOld stock images attributes variants");
    const productMap = new Map((products as any[]).map((p: any) => [String(p._id), p]));

    const allAttrIds = (products as any[]).flatMap((p: any) => p.attributes || []);
    const attrList = await AttributeProduct.find({ _id: { $in: allAttrIds } }).select("_id name");
    const attrMap = new Map((attrList as any[]).map((a: any) => [String(a._id), a]));

    for (const item of wishlist) {
      const productDetail = productMap.get(String(item.productId));
      if (productDetail) {
        const attributeList = (productDetail.attributes || []).map((id: any) => attrMap.get(String(id))).filter(Boolean);
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

    res.json({
      code: "success",
      message: "Success!",
      wishlist: wishlistDetail
    })
  } catch (error) {
    res.json({
      code: "error",
      message: "Invalid data!"
    })
  }
}