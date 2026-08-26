import { Request, Response } from 'express';
import * as productService from '../../services/client/product.service';

export const productByCategory = async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug;
    const data = await productService.getProductsByCategory(slug, req.query);

    if (!data) {
      res.redirect("/");
      return;
    }

    const { categoryDetail, productList, pagination, topRatedProducts } = data;
    const categoryId = '_id' in categoryDetail && categoryDetail._id ? String(categoryDetail._id) : (categoryDetail as { id?: string }).id;

    if (categoryId && '_id' in categoryDetail) {
      const viewed = `viewed_product_category_${categoryId}`;
      res.cookie(viewed, "true", {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 60 * 1000
      });
      if (!req.cookies[viewed]) {
        await productService.incrementCategoryProductView(categoryId);
        categoryDetail.view = (categoryDetail.view || 0) + 1;
      }
    }

    res.render("client/pages/product-by-category", {
      pageTitle: categoryDetail.name,
      categoryDetail: categoryDetail,
      productList: productList,
      pagination: pagination,
      topRatedProducts: topRatedProducts
    });
  } catch (error) {
    console.error("productByCategory error:", error);
    res.redirect("/");
  }
};

export const suggest = async (req: Request, res: Response) => {
  try {
    const productList = await productService.getProductSuggestions(req.query.keyword);
    res.json({
      code: "success",
      message: "Success!",
      list: productList
    });
  } catch (error) {
    console.error("product suggest error:", error);
    res.json({
      code: "error",
      message: "Failed!"
    });
  }
};

export const detail = async (req: Request, res: Response) => {
  try {
    const productViewHistory: string[] = req.cookies.productViewHistory ? JSON.parse(req.cookies.productViewHistory) : [];

    const data = await productService.getProductDetailBySlug(req.params.slug, productViewHistory);
    if (!data) {
      res.redirect("/");
      return;
    }

    const {
      productDetail,
      attributeList,
      relatedProducts,
      boughtTogetherProducts,
      viewedProducts,
      reviewList
    } = data;

    const viewed = `viewed_product_${productDetail.id}`;
    res.cookie(viewed, "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 60 * 1000
    });
    if (!req.cookies[viewed]) {
      await productService.incrementProductView(productDetail.id);
      productDetail.view = (productDetail.view || 0) + 1;
    }

    if (!productViewHistory.includes(productDetail.id)) {
      productViewHistory.unshift(productDetail.id);
      res.cookie("productViewHistory", JSON.stringify(productViewHistory), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000
      });
    }

    res.render("client/pages/product-detail", {
      pageTitle: productDetail.name,
      productDetail: productDetail,
      attributeList: attributeList,
      relatedProducts: relatedProducts,
      boughtTogetherProducts: boughtTogetherProducts,
      viewedProducts: viewedProducts,
      reviewList: reviewList,
      seo: productDetail.seo
    });
  } catch (error) {
    console.error("product detail error:", error);
    res.redirect("/");
  }
};

export const reportReviewPost = async (req: Request, res: Response) => {
  try {
    const reviewId = req.params.id;
    const userId = res.locals.accountUser?.id;

    if (!userId) {
      res.json({ code: "error", message: "User not authenticated!" });
      return;
    }

    const result = await productService.reportReview(reviewId, userId);
    res.json({
      code: result.success ? "success" : "error",
      message: result.message
    });
  } catch (error) {
    console.error("reportReview error:", error);
    res.json({ code: "error", message: "Invalid data!" });
  }
};
