import { Request, Response } from 'express';
import * as productService from '../../services/client/product.service';
import { PRODUCT_DISPLAY_CONFIG } from '../../configs/product-display.config';
import { resultStatus, sendCaughtError } from "../../helpers/http-response.helper";
import { alreadyViewed, claimView } from "../../helpers/view-counter.helper";

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
      if (!alreadyViewed(req, `product_category_${categoryId}`)) {
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
    sendCaughtError(res, error, "Failed!", "Failed!");
  }
};

const readViewHistory = (req: Request): string[] => {
  try {
    if (req.cookies.productViewHistory) {
      const parsed = JSON.parse(req.cookies.productViewHistory);
      if (Array.isArray(parsed)) {
        return parsed.filter((id): id is string => typeof id === "string" && id.length === 24);
      }
    }
  } catch {
    return [];
  }
  return [];
};

export const detail = async (req: Request, res: Response) => {
  try {
    const productViewHistory = readViewHistory(req);

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

    const productId = String(productDetail.id || productDetail._id);
    if (!alreadyViewed(req, `product_${productId}`)) {
      productDetail.view = (productDetail.view || 0) + 1;
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
      res.status(401).json({ code: "error", message: "User not authenticated!" });
      return;
    }

    const result = await productService.reportReview(reviewId, userId);
    res.status(resultStatus(result)).json({
      code: result.success ? "success" : "error",
      message: result.message
    });
  } catch (error) {
    console.error("reportReview error:", error);
    sendCaughtError(res, error, "Invalid data!");
  }
};

export const categoryView = async (req: Request, res: Response) => {
  try {
    const id = await productService.getCategoryIdBySlug(req.params.slug);
    if (!id) {
      res.status(404).json({ code: "error", message: "Category does not exist!" });
      return;
    }
    if (claimView(req, res, `product_category_${id}`)) await productService.incrementCategoryProductView(id);
    res.json({ code: "success", message: "Success!" });
  } catch (error) {
    console.error("product category view error:", error);
    sendCaughtError(res, error, "Invalid data!");
  }
};

export const detailView = async (req: Request, res: Response) => {
  try {
    const productId = await productService.getProductIdBySlug(req.params.slug);
    if (!productId) {
      res.status(404).json({ code: "error", message: "Product does not exist!" });
      return;
    }
    if (claimView(req, res, `product_${productId}`)) await productService.incrementProductView(productId);

    const updatedHistory = [productId, ...readViewHistory(req).filter((id) => id !== productId)].slice(0, PRODUCT_DISPLAY_CONFIG.VIEWED_PRODUCTS_LIMIT);
    res.cookie("productViewHistory", JSON.stringify(updatedHistory), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 30 * 24 * 60 * 60 * 1000
    });
    res.json({ code: "success", message: "Success!" });
  } catch (error) {
    console.error("product view error:", error);
    sendCaughtError(res, error, "Invalid data!");
  }
};
