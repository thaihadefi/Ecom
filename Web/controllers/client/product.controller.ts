import { toSearchText } from '../../helpers/slugify.helper';
import { escapeRegex } from '../../helpers/generate.helper';
import { Request, Response } from 'express';
import CategoryProduct from '../../models/category-product.model';
import Product from '../../models/product.model';
import AttributeProduct from '../../models/attribute-product.model';
import { formatProductItem } from '../../helpers/product.helper';
import Review from '../../models/review.model';
import AccountUser from '../../models/account-user.model';
import { PAGINATION } from '../../configs/pagination.config';
import { getPagination } from '../../helpers/pagination.helper';

export const productByCategory = async (req: Request, res: Response) => {
  const slug = req.params.slug;
  let categoryDetail: any = null;

  if(slug) {
    categoryDetail = await CategoryProduct.findOne({
      slug: slug,
      deleted: false,
      status: "active"
    })
  } else {
    categoryDetail = {
      id: "",
      name: "All Products",
      slug: ""
    };
  }

  if(!categoryDetail) {
    res.redirect("/");
    return;
  }

  // Increase category view count if viewing a specific category
  if(categoryDetail.id) {
    const viewed = `viewed_product_category_${categoryDetail.id}`;
    res.cookie(viewed, "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 60 * 1000 // 30 minutes
    });
    if(!req.cookies[viewed]) {
      await CategoryProduct.updateOne({
        _id: categoryDetail.id,
        deleted: false,
        status: "active"
      }, {
        $inc: { view: 1 }
      });
      categoryDetail.view = (categoryDetail.view || 0) + 1;
    }
  }

  const find: {
    category?: string,
    status: string,
    deleted: boolean,
    priceNew?: {
      $gte: number,
      $lte: number
    },
    discount?: {
      $gt: number
    },
    stock?: {
      $gt: number
    },
    $or?: any,
    search?: RegExp
  } = {
    deleted: false,
    status: "active",
  };

  // Category
  if(categoryDetail.id) {
    find.category = categoryDetail.id;
  }
  // End Category

  // Keyword
  if(req.query.keyword) {
    const keyword = toSearchText(`${req.query.keyword}`);
    const keywordRegex = new RegExp(escapeRegex(keyword), "i");
    find.search = keywordRegex;
  }
  // End Keyword

  // Price range
  if(req.query.price) {
    const [priceMin, priceMax] = `${req.query.price}`.split("-").map(item => parseInt(item));
    find.priceNew = {
      $gte: priceMin,
      $lte: priceMax
    };
  }
  // End Price range

  // On Sale
  if(req.query.onSale && req.query.onSale == "true") {
    find.discount = {
      $gt: 0
    }
  }
  // End On Sale

  // In Stock
  if(req.query.inStock && req.query.inStock == "true") {
    find.stock = {
      $gt: 0
    }
  }
  // End In Stock

  // Attributes
  const attributeFilters: any[] = [];

  Object.keys(req.query).forEach(key => {
    if(key.startsWith("attribute_")) {
      const attrId = key.replace("attribute_", "");
      const values = `${req.query[key]}`.split(",");
      
      attributeFilters.push(
        {
          variants: {
            $elemMatch: {
              status: true,
              attributeValue: {
                $elemMatch: {
                  attrId: attrId,
                  value: { $in: values }
                }
              }
            }
          }
        }
      );

      if(attributeFilters.length > 0) {
        find.$or = attributeFilters;
      }
    }
  })
  // End Attributes

  // Rating
  if(req.query.rating) {
    const ratings = `${req.query.rating}`
      .split(",")
      .map(r => parseInt(r));

    if (ratings.length > 0) {
      const ratingOr = ratings.map(star => ({
        ratingAvg: {
          $gte: star,
          $lt: star + 1
        }
      }));

      if (find.$or) {
        // Both attribute and rating filters — combine with $and
        (find as any).$and = [
          { $or: find.$or },
          { $or: ratingOr }
        ];
        delete find.$or;
      } else {
        find.$or = ratingOr;
      }
    }
  }
  // End Rating

  // Pagination
  let limitItems = PAGINATION.CLIENT_LIMIT;
  if(req.query.limitItems) {
    const currentLimitItems = parseInt(`${req.query.limitItems}`);
    if(currentLimitItems > 0) {
      limitItems = currentLimitItems;
    }
  }

  const totalRecord = await Product.countDocuments(find);
  const pagination = getPagination(req.query.page, limitItems, totalRecord);
  // End Pagination

  // Sort
  const sort: any = {};
  if(req.query.sort) {
    const [sortKey, sortValue] = `${req.query.sort}`.split("-");
    switch (sortKey) {
      case "position":
        sort.position = sortValue;
        break;
      case "price":
        sort.priceNew = sortValue;
        sort.position = sortValue;
        break;
      case "createdAt":
        sort.createdAt = sortValue;
        break;
      case "discount":
        sort.discount = sortValue;
        sort.position = sortValue;
        break;
      default:
        sort.position = "desc";
        break;
    }
  } else {
    sort.position = "desc";
  }
  // End Sort

  const productList: any = await Product
    .find(find)
    .select("_id name slug images priceNew priceOld variants ratingAvg ratingCount")
    .limit(limitItems)
    .skip(pagination.skip)
    .sort(sort)

  for (const item of productList) {
    formatProductItem(item);
  }

  // Top rated products
  const topRatedProducts: any = await Product
    .find({ deleted: false, status: "active", ratingAvg: { $gte: 4 } })
    .select("_id name slug images priceNew priceOld variants ratingAvg ratingCount")
    .sort({ ratingAvg: "desc" })
    .limit(5)
  for (const item of topRatedProducts) {
    formatProductItem(item);
  }
  // End Top rated products

  res.render("client/pages/product-by-category", {
    pageTitle: categoryDetail.name,
    categoryDetail: categoryDetail,
    productList: productList,
    pagination: pagination,
    topRatedProducts: topRatedProducts
  });
}

export const suggest = async (req: Request, res: Response) => {
  const find: {
    status: string,
    deleted: boolean,
    priceNew: {
      $gt: number
    },
    stock: {
      $gt: number
    },
    search?: RegExp
  } = {
    deleted: false,
    status: "active",
    priceNew: {
      $gt: 0
    },
    stock: {
      $gt: 0
    }
  };

  // Keyword
  if(req.query.keyword) {
    const keyword = toSearchText(`${req.query.keyword}`);
    const keywordRegex = new RegExp(escapeRegex(keyword), "i");
    find.search = keywordRegex;
  }
  // End Keyword

  const productList = await Product
    .find(find)
    .limit(5)
    .sort({
      position: "desc"
    })
    .select("images name slug priceNew priceOld")

  res.json({
    code: "success",
    message: "Success!",
    list: productList
  })
}

export const detail = async (req: Request, res: Response) => {
  const productDetail: any = await Product.findOne({
    slug: req.params.slug,
    deleted: false,
    status: "active"
  })

  if(!productDetail) {
    res.redirect("/");
    return;
  }

  // Increase view count
  const viewed = `viewed_product_${productDetail.id}`;
  res.cookie(viewed, "true", {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 30 * 60 * 1000 // 30 minutes
  });
  if(!req.cookies[viewed]) {
    await Product.updateOne({
      _id: productDetail.id,
      deleted: false,
      status: "active"
    }, {
      $inc: { view: 1 }
    });
    productDetail.view = (productDetail.view || 0) + 1;
  }


  // Attributes list
  const attributeList: any = await AttributeProduct.find({
    _id: { $in: productDetail.attributes }
  }).select("_id name")
  for (const attribute of attributeList) {
    const variantSet = new Set();
    const variantLabelSet = new Set();
    productDetail.variants
      .filter((variant: any) => variant.status)
      .forEach((variant: any) => {
        variant.attributeValue.forEach((attr: any) => {
          if(attr.attrId == attribute.id) {
            variantSet.add(attr.value);
            variantLabelSet.add(attr.label);
          }
        })
      })
    attribute.variants = [...variantSet];
    attribute.variantsLabel = [...variantLabelSet];
  }
  // End Attributes list

  // Categories list
  const categoryList = await CategoryProduct
    .find({ _id: { $in: productDetail.category }, deleted: false, status: "active" })
    .select("name slug")
  productDetail.categoryList = categoryList;
  // End Categories list

  // Related products
  const relatedProducts: any = await Product
    .find({
      _id: { $ne: productDetail.id }, // Exclude current product
      category: { $in: productDetail.category },
      deleted: false,
      status: "active"
    })
    .select("_id name slug images priceNew priceOld variants ratingAvg ratingCount")
    .sort({ view: "desc" })
    .limit(10)

  for (const item of relatedProducts) {
    formatProductItem(item);
  }
  // End Related products

  // Bought together products
  const boughtTogetherProducts: any = await Product
    .find({
      _id: { $in: productDetail.boughtTogether },
      deleted: false,
      status: "active"
    })
    .select("_id name slug images priceNew priceOld variants ratingAvg ratingCount")
    .sort({ position: "desc" })

  for (const item of boughtTogetherProducts) {
    formatProductItem(item);
  }
  // End Bought together products

  // Product view history
  const productViewHistory = req.cookies.productViewHistory ? JSON.parse(req.cookies.productViewHistory) : [];

  // Viewed products list
  const viewedProducts: any = await Product
    .find({
      _id: { $in: productViewHistory },
      deleted: false,
      status: "active"
    })
    .select("_id name slug images priceNew priceOld variants ratingAvg ratingCount")

  for (const item of viewedProducts) {
    formatProductItem(item);
  }
  // End Viewed products list

  if(!productViewHistory.includes(productDetail.id)) {
    productViewHistory.unshift(productDetail.id);
    res.cookie("productViewHistory", JSON.stringify(productViewHistory), {
      httpOnly: true, // Only accessible by server, client JavaScript cannot read this cookie
      secure: process.env.NODE_ENV === 'production', // true if https, false if http
      sameSite: 'strict', // Only send cookie for same domain requests
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });
  }
  // End Product view history

  // Reviews list
  const reviewList: any = await Review
    .find({ productId: productDetail.id, status: { $ne: "rejected" } })
    .select("userId rating comment images reportCount reportedBy createdAt")
    .sort({ createdAt: "desc" })

  const reviewUserIds = [...new Set(reviewList.map((r: any) => String(r.userId)).filter(Boolean))];
  if (reviewUserIds.length > 0) {
    const users = await AccountUser.find({ _id: { $in: reviewUserIds } }).select("_id fullName avatar");
    const userMap = new Map((users as any[]).map((u: any) => [String(u._id), u]));
    for (const item of reviewList) {
      const u = item.userId ? userMap.get(String(item.userId)) : undefined;
      if (u) item.user = { fullName: u.fullName, avatar: u.avatar };
    }
  }
  // End Reviews list

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
}

export const reportReviewPost = async (req: Request, res: Response) => {
  try {
    const reviewId = req.params.id;
    const userId = res.locals.accountUser.id;

    const review = await Review.findById(reviewId).select("_id reportedBy");
    if (!review) {
      res.json({ code: "error", message: "Review not found!" });
      return;
    }

    const alreadyReported = (review as any).reportedBy?.includes(userId);
    if (alreadyReported) {
      res.json({ code: "error", message: "You have already reported this review!" });
      return;
    }

    await Review.updateOne({ _id: reviewId }, {
      $inc: { reportCount: 1 },
      $push: { reportedBy: userId }
    });

    res.json({ code: "success", message: "Review reported successfully!" });
  } catch (error) {
    console.error(error);
    res.json({ code: "error", message: "Invalid data!" });
  }
}