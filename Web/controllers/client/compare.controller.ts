import { Request, Response } from 'express';
import Product from '../../models/product.model';
import AttributeProduct from '../../models/attribute-product.model';

export const compare = (req: Request, res: Response) => {
  res.render("client/pages/compare", {
    pageTitle: "Product Compare"
  });
}

export const list = async (req: Request, res: Response) => {
  try {
    const compareList = req.body;
    const compareDetail: any[] = [];

    const productIds = compareList.map((i: any) => i.productId);
    const products = await Product.find({
      _id: { $in: productIds },
      deleted: false,
      status: "active"
    }).select("_id slug name description priceNew priceOld stock images attributes variants");
    const productMap = new Map((products as any[]).map((p: any) => [String(p._id), p]));

    const allAttrIds = (products as any[]).flatMap((p: any) => p.attributes || []);
    const attrList = await AttributeProduct.find({ _id: { $in: allAttrIds } }).select("_id name");
    const attrMap = new Map((attrList as any[]).map((a: any) => [String(a._id), a]));

    for (const item of compareList) {
      const productDetail = productMap.get(String(item.productId));
      if (productDetail) {
        const attributeList = (productDetail.attributes || []).map((id: any) => attrMap.get(String(id))).filter(Boolean);
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

    res.json({
      code: "success",
      message: "Success!",
      compareList: compareDetail
    })
  } catch (error) {
    res.json({
      code: "error",
      message: "Invalid data!"
    })
  }
}