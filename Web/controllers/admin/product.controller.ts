import { toSearchText } from '../../helpers/slugify.helper';
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import CategoryProduct from '../../models/category-product.model';
import { buildCategoryTree } from '../../helpers/category.helper';
import { pathAdmin } from '../../configs/variable.config';
import Product from '../../models/product.model';
import { logAdminAction } from '../../helpers/log.helper';
import AttributeProduct from '../../models/attribute-product.model';
import { Parser } from 'json2csv';
import Papa from 'papaparse';
import { generateRandomString, escapeRegex } from '../../helpers/generate.helper';
import { pingGoogleSitemap } from '../../helpers/ping-google.helper';
import Review from '../../models/review.model';
import { PAGINATION } from '../../configs/pagination.config';
import { getPagination } from '../../helpers/pagination.helper';

export const category = async (req: Request, res: Response) => {
  const find: {
    deleted: boolean,
    search?: RegExp
  } = {
    deleted: false
  };

  if(req.query.keyword) {
    const keyword = toSearchText(`${req.query.keyword}`);
    const keywordRegex = new RegExp(escapeRegex(keyword), "i");
    find.search = keywordRegex;
  }

  // Pagination
  const limitItems = PAGINATION.ADMIN_LIMIT;
  const totalRecord = await CategoryProduct.countDocuments(find);
  const pagination = getPagination(req.query.page, limitItems, totalRecord);
  // End Pagination

  const recordList: any = await CategoryProduct
    .find(find)
    .select("_id name slug parent avatar status view")
    .sort({ createdAt: "desc" })
    .limit(limitItems)
    .skip(pagination.skip)

  const parentIds = [...new Set(recordList.filter((i: any) => i.parent).map((i: any) => String(i.parent)))];
  if (parentIds.length > 0) {
    const parents = await CategoryProduct.find({ _id: { $in: parentIds } }).select("name");
    const parentMap = new Map(parents.map((p: any) => [String(p._id), p.name]));
    for (const item of recordList) {
      if (item.parent) item.parentName = parentMap.get(String(item.parent));
    }
  }

  res.render("admin/pages/product-category", {
    pageTitle: "Product Category Management",
    recordList: recordList,
    pagination: pagination
  });
}

export const createCategory = async (req: Request, res: Response) => {
  const categoryList = await CategoryProduct.find({}).select("_id name slug parent status");

  const categoryTree = buildCategoryTree(categoryList);

  res.render("admin/pages/product-create-category", {
    pageTitle: "Create Product Category",
    categoryList: categoryTree
  });
}

export const createCategoryPost = async (req: Request, res: Response) => {
  try {
    const existSlug = await CategoryProduct.findOne({
      slug: req.body.slug
    }).select("_id")

    if(existSlug) {
      res.json({
        code: "error",
        message: "Slug already exists!"
      })
      return;
    }

    req.body.search = toSearchText(`${req.body.name}`);

    const newRecord = new CategoryProduct(req.body);
    await newRecord.save();

    res.json({
      code: "success",
      message: "Category created successfully!"
    })
  } catch (error) {
    res.json({
      code: "error",
      message: "Invalid data!"
    })
  }
}

export const editCategory = async (req: Request, res: Response) => {
  try {
    const categoryList = await CategoryProduct.find({}).select("_id name slug parent status");

    const categoryTree = buildCategoryTree(categoryList);

    const id = req.params.id;

    const categoryDetail = await CategoryProduct.findOne({
      _id: id,
      deleted: false
    })

    if(!categoryDetail) {
      res.redirect(`/${pathAdmin}/product/category`);
      return;
    }

    res.render("admin/pages/product-edit-category", {
      pageTitle: "Edit Product Category",
      categoryList: categoryTree,
      categoryDetail: categoryDetail
    });
  } catch (error) {
    res.redirect(`/${pathAdmin}/product/category`);
  }
}

export const editCategoryPatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    const existSlug = await CategoryProduct.findOne({
      _id: { $ne: id }, // Exclude record with _id matching the passed id
      slug: req.body.slug
    }).select("_id")

    if(existSlug) {
      res.json({
        code: "error",
        message: "Slug already exists!"
      })
      return;
    }

    req.body.search = toSearchText(`${req.body.name}`);

    await CategoryProduct.updateOne({
      _id: id,
      deleted: false
    }, req.body)

    res.json({
      code: "success",
      message: "Updated successfully!"
    })
  } catch (error) {
    res.json({
      code: "error",
      message: "Invalid data!"
    })
  }
}

export const deleteCategoryPatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    await CategoryProduct.updateOne({
      _id: id
    }, {
      deleted: true,
      deletedAt: Date.now()
    })

    res.json({
      code: "success",
      message: "Category deleted successfully!"
    })
  } catch (error) {
    res.json({
      code: "error",
      message: "Invalid ID!"
    })
  }
}

export const trashCategory = async (req: Request, res: Response) => {
  const recordList: any = await CategoryProduct.find({ deleted: true }).sort({ deletedAt: "desc" });

  const parentIds = [...new Set(recordList.filter((i: any) => i.parent).map((i: any) => String(i.parent)))];
  if (parentIds.length > 0) {
    const parents = await CategoryProduct.find({ _id: { $in: parentIds } }).select("name");
    const parentMap = new Map(parents.map((p: any) => [String(p._id), p.name]));
    for (const item of recordList) {
      if (item.parent) item.parentName = parentMap.get(String(item.parent));
    }
  }

  res.render("admin/pages/product-category-trash", {
    pageTitle: "Product Category Trash",
    recordList: recordList
  });
}

export const undoCategoryPatch = async (req: Request, res: Response) => {
  try {
    await CategoryProduct.updateOne({ _id: req.params.id }, { deleted: false });
    res.json({ code: "success", message: "Restored successfully!" });
  } catch (error) {
    res.json({ code: "error", message: "Invalid ID!" });
  }
}

export const destroyCategoryDelete = async (req: Request, res: Response) => {
  try {
    await CategoryProduct.deleteOne({ _id: req.params.id });
    res.json({ code: "success", message: "Deleted permanently!" });
  } catch (error) {
    res.json({ code: "error", message: "Invalid ID!" });
  }
}

export const create = async (req: Request, res: Response) => {
  const [categoryList, attributeList] = await Promise.all([
    CategoryProduct.find({ deleted: false }).select("_id name slug parent status"),
    AttributeProduct.find({ deleted: false }).select("_id name type options")
  ]);

  const categoryTree = buildCategoryTree(categoryList);

  // Product list
  const productList = await Product
    .find({
      deleted: false,
      status: "active"
    })
    .sort({
      position: "desc"
    })
    .select("id name")
  // End Product list

  res.render("admin/pages/product-create", {
    pageTitle: "Create Product",
    categoryList: categoryTree,
    attributeList: attributeList,
    productList: productList
  });
}

export const createPost = async (req: Request, res: Response) => {
  try {
    const existSlug = await Product.findOne({
      slug: req.body.slug
    }).select("_id")

    if(existSlug) {
      res.json({
        code: "error",
        message: "Slug already exists!"
      })
      return;
    }

    if(req.body.position) {
      req.body.position = parseInt(req.body.position);
    } else {
      // If position is not provided -> get max position + 1
      const recordMaxPosition = await Product
        .findOne({})
        .select("position")
        .sort({
          position: "desc"
        });
      if(recordMaxPosition && recordMaxPosition.position) {
        req.body.position = recordMaxPosition.position + 1;
      } else {
        req.body.position = 1;
      }
    }

    req.body.category = JSON.parse(req.body.category);

    req.body.images = JSON.parse(req.body.images);

    req.body.search = toSearchText(`${req.body.name}`);

    if(req.body.priceOld) {
      req.body.priceOld = parseInt(req.body.priceOld);
    }

    if(req.body.priceNew) {
      req.body.priceNew = parseInt(req.body.priceNew);
      req.body.discount = Math.floor(((req.body.priceOld - req.body.priceNew) / req.body.priceOld) * 100);
    } else {
      req.body.priceNew = req.body.priceOld;
      req.body.discount = 0;
    }

    if(req.body.stock) {
      req.body.stock = parseInt(req.body.stock);
    }

    req.body.attributes = JSON.parse(req.body.attributes);

    req.body.variants = JSON.parse(req.body.variants);

    req.body.tags = JSON.parse(req.body.tags);

    req.body.boughtTogether = JSON.parse(req.body.boughtTogether);

    req.body.sku = generateRandomString(10).toUpperCase();

    // Add default SEO
    req.body.seo = {
      title: req.body.name,
      description: "",
      keywords: req.body.tags || [],
      robots: {
        index: true,
        follow: true,
      },
      og: {
        title: req.body.name,
        description: "",
        image: req.body.images?.[0] || "",
      },
    };
    // End Add default SEO

    const newRecord = new Product(req.body);
    await newRecord.save();

    logAdminAction(req, `Created product: ${req.body.name} (Id: ${newRecord.id})`);

    // Ping Google
    await pingGoogleSitemap();

    res.json({
      code: "success",
      message: "Product created successfully!"
    })
  } catch (error) {
    res.json({
      code: "error",
      message: "Invalid data!"
    })
  }
}

export const list = async (req: Request, res: Response) => {
  const find: {
    deleted: boolean,
    search?: RegExp
  } = {
    deleted: false
  };

  if(req.query.keyword) {
    const keyword = toSearchText(`${req.query.keyword}`)
    const keywordRegex = new RegExp(escapeRegex(keyword), "i");
    find.search = keywordRegex;
  }

  // Pagination
  const limitItems = PAGINATION.ADMIN_LIMIT;
  const totalRecord = await Product.countDocuments(find);
  const pagination = getPagination(req.query.page, limitItems, totalRecord);
  // End Pagination

  const recordList: any = await Product
    .find(find)
    .select("_id name slug images priceNew priceOld position stock view status")
    .limit(limitItems)
    .skip(pagination.skip)
    .sort({
      position: "desc"
    });

  res.render("admin/pages/product-list", {
    pageTitle: "Product Management",
    recordList: recordList,
    pagination: pagination
  });
}

export const edit = async (req: Request, res: Response) => {
  try {
    const [categoryList, attributeList] = await Promise.all([
      CategoryProduct.find({ deleted: false }).select("_id name slug parent status"),
      AttributeProduct.find({ deleted: false }).select("_id name type options")
    ]);

    const categoryTree = buildCategoryTree(categoryList);

    const id = req.params.id;

    const productDetail = await Product.findOne({
      _id: id,
      deleted: false
    })

    if(!productDetail) {
      res.redirect(`/${pathAdmin}/product/list`);
      return;
    }

    // Selected attributes
    const attributeNameList: string[] = [];
    productDetail.attributes.forEach(attrId => {
      const attributeInfo = (attributeList as any[]).find((item: any) => String(item._id) === String(attrId));
      if(attributeInfo) {
        attributeNameList.push(`${attributeInfo.name}`);
      }
    });

    // Product list
    const productList = await Product
      .find({
        _id: { $ne: productDetail.id },
        deleted: false,
        status: "active"
      })
      .sort({
        position: "desc"
      })
      .select("id name")
    // End Product list

    res.render("admin/pages/product-edit", {
      pageTitle: "Edit Product",
      categoryList: categoryTree,
      attributeList: attributeList,
      productDetail: productDetail,
      attributeNameList: attributeNameList,
      productList: productList
    });
  } catch (error) {
    console.log(error);
    res.redirect(`/${pathAdmin}/product/list`);
  }
}

export const editPatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    const productDetail = await Product.findOne({
      _id: id,
      deleted: false
    })

    if(!productDetail) {
      res.json({
        code: "error",
        message: "Product does not exist!"
      });
      return;
    }

    const existSlug = await Product.findOne({
      _id: { $ne: id },
      slug: req.body.slug
    }).select("_id")

    if(existSlug) {
      res.json({
        code: "error",
        message: "Slug already exists!"
      })
      return;
    }

    if(req.body.position) {
      req.body.position = parseInt(req.body.position);
    } else {
      // If position is not provided -> get max position + 1
      const recordMaxPosition = await Product
        .findOne({})
        .select("position")
        .sort({
          position: "desc"
        });
      if(recordMaxPosition && recordMaxPosition.position) {
        req.body.position = recordMaxPosition.position + 1;
      } else {
        req.body.position = 1;
      }
    }

    req.body.category = JSON.parse(req.body.category);

    req.body.images = JSON.parse(req.body.images);

    req.body.search = toSearchText(`${req.body.name}`);

    if(req.body.priceOld) {
      req.body.priceOld = parseInt(req.body.priceOld);
    }

    if(req.body.priceNew) {
      req.body.priceNew = parseInt(req.body.priceNew);
      req.body.discount = Math.floor(((req.body.priceOld - req.body.priceNew) / req.body.priceOld) * 100);
    } else {
      req.body.priceNew = req.body.priceOld;
      req.body.discount = 0;
    }

    if(req.body.stock) {
      req.body.stock = parseInt(req.body.stock);
    }

    req.body.attributes = JSON.parse(req.body.attributes);

    req.body.variants = JSON.parse(req.body.variants);

    req.body.tags = JSON.parse(req.body.tags);

    req.body.boughtTogether = JSON.parse(req.body.boughtTogether);

    if(!productDetail.sku) {
      req.body.sku = generateRandomString(10).toUpperCase();
    }

    await Product.updateOne({
      _id: id,
      deleted: false
    }, req.body);

    logAdminAction(req, `Edited product: ${productDetail.name} (Id: ${productDetail.id})`);

    res.json({
      code: "success",
      message: "Product updated successfully!"
    })
  } catch (error) {
    console.log(error);
    res.json({
      code: "error",
      message: "Invalid data!"
    });
  }
}

export const deletePatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    await Product.updateOne({
      _id: id
    }, {
      deleted: true,
      deletedAt: Date.now(),
    });

    res.json({
      code: "success",
      message: "Product deleted successfully!"
    })
  } catch (error) {
    console.log(error);
    res.json({
      code: "error",
      message: "Invalid ID!"
    })
  }
}

export const attribute = async (req: Request, res: Response) => {
  const find: {
    deleted: boolean,
    search?: RegExp
  } = {
    deleted: false
  };

  if(req.query.keyword) {
    const keyword = toSearchText(`${req.query.keyword}`)
    const keywordRegex = new RegExp(escapeRegex(keyword), "i");
    find.search = keywordRegex;
  }

  // Pagination
  const limitItems = PAGINATION.ADMIN_LIMIT;
  const totalRecord = await AttributeProduct.countDocuments(find);
  const pagination = getPagination(req.query.page, limitItems, totalRecord);
  // End Pagination

  const recordList: any = await AttributeProduct
    .find(find)
    .select("_id name type options")
    .limit(limitItems)
    .skip(pagination.skip)
    .sort({
      createdAt: "desc"
    });

  res.render("admin/pages/product-attribute", {
    pageTitle: "Product Attribute Management",
    recordList: recordList,
    pagination: pagination
  });
}

export const createAttribute = async (req: Request, res: Response) => {
  res.render("admin/pages/product-create-attribute", {
    pageTitle: "Create Product Attribute"
  });
}

export const createAttributePost = async (req: Request, res: Response) => {
  try {
    req.body.options = JSON.parse(req.body.options);

    req.body.search = toSearchText(`${req.body.name}`);

    const newRecord = new AttributeProduct(req.body);
    await newRecord.save();

    res.json({
      code: "success",
      message: "Attribute created successfully!"
    })
  } catch (error) {
    console.error(error);
    res.json({
      code: "error",
      message: "Invalid data!"
    })
  }
}

export const editAttribute = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    const attributeDetail = await AttributeProduct.findOne({
      _id: id,
      deleted: false
    })

    if(!attributeDetail) {
      res.redirect(`/${pathAdmin}/product/attribute`);
      return;
    }

    res.render("admin/pages/product-edit-attribute", {
      pageTitle: "Edit Product Attribute",
      attributeDetail: attributeDetail
    });
  } catch (error) {
    console.log(error);
    res.redirect(`/${pathAdmin}/product/attribute`);
  }
}

export const editAttributePatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    req.body.options = JSON.parse(req.body.options);
    
    req.body.search = toSearchText(req.body.name)

    await AttributeProduct.updateOne({
      _id: id,
      deleted: false
    }, req.body);

    res.json({
      code: "success",
      message: "Attribute updated successfully!"
    })
  } catch (error) {
    console.log(error);
    res.json({
      code: "error",
      message: "Invalid data!"
    })
  }
}

export const deleteAttributePatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    await AttributeProduct.updateOne({
      _id: id
    }, {
      deleted: true,
      deletedAt: Date.now(),
    });

    res.json({
      code: "success",
      message: "Attribute deleted successfully!"
    })
  } catch (error) {
    console.log(error);
    res.json({
      code: "error",
      message: "Invalid ID!"
    })
  }
}

export const trashAttribute = async (req: Request, res: Response) => {
  const recordList: any = await AttributeProduct.find({ deleted: true }).select("_id name type deletedAt").sort({ deletedAt: "desc" });

  res.render("admin/pages/product-attribute-trash", {
    pageTitle: "Product Attribute Trash",
    recordList: recordList
  });
}

export const undoAttributePatch = async (req: Request, res: Response) => {
  try {
    await AttributeProduct.updateOne({ _id: req.params.id }, { deleted: false });
    res.json({ code: "success", message: "Restored successfully!" });
  } catch (error) {
    res.json({ code: "error", message: "Invalid ID!" });
  }
}

export const destroyAttributeDelete = async (req: Request, res: Response) => {
  try {
    await AttributeProduct.deleteOne({ _id: req.params.id });
    res.json({ code: "success", message: "Deleted permanently!" });
  } catch (error) {
    res.json({ code: "error", message: "Invalid ID!" });
  }
}

export const exportCSV = async (req: Request, res: Response) => {
  try {
    res.header('Content-Type', 'text/csv');
    res.attachment('products.csv');
    res.write('\ufeff'); // BOM

    const BATCH = 500;
    let skip = 0;
    let headerWritten = false;
    const parser = new Parser({ header: true });

    while (true) {
      const batch = await Product.find({ deleted: false }).skip(skip).limit(BATCH);
      if (!batch.length) break;

      let csv = parser.parse(batch);
      if (headerWritten) {
        csv = csv.substring(csv.indexOf("\n") + 1);
      }
      res.write(csv + "\n");
      headerWritten = true;
      skip += BATCH;
      if (batch.length < BATCH) break;
    }

    res.end();
  } catch (error) {
    console.log(error);
  }
}

export const importCSVPost = async (req: Request, res: Response) => {
  try {
    // Convert CSV to JS
    const result = Papa.parse(`${req.file?.buffer}`, {
      header: true,
      skipEmptyLines: true
    });

    const items: any[] = result.data;

    const operations = items.map((item) => {
      item.position = item.position ? parseInt(item.position) : 0;
      item.category = item.category ? JSON.parse(item.category) : [];
      item.priceOld = item.priceOld ? parseInt(item.priceOld) : 0;
      item.priceNew = item.priceNew ? parseInt(item.priceNew) : 0;
      item.stock = item.stock ? parseInt(item.stock) : 0;
      item.attributes = item.attributes ? JSON.parse(item.attributes) : [];
      item.variants = item.variants ? JSON.parse(item.variants) : [];
      item.images = item.images ? JSON.parse(item.images) : [];
      item.view = item.view ? parseInt(item.view) : 0;
      item.tags = item.tags ? JSON.parse(item.tags) : [];
      item.deleted = item.deleted == "true" ? true : false;
      item.deletedAt = item.deletedAt ? new Date(item.deletedAt) : undefined;
      item.createdAt = item.createdAt ? new Date(item.createdAt) : undefined;
      item.updatedAt = item.updatedAt ? new Date(item.updatedAt) : undefined;

      return {
        updateOne: {
          filter: { _id: item._id },
          update: item
        }
      };
    });

    if (operations.length > 0) {
      await Product.bulkWrite(operations);
    }

    res.json({
      code: "success",
      message: "File uploaded successfully!"
    })
  } catch (error) {
    console.log(error);
    res.json({
      code: "error",
      message: "Invalid data!"
    })
  }
}

export const editSEO = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    const productDetail = await Product.findOne({
      _id: id,
      deleted: false
    })

    if(!productDetail) {
      res.redirect(`/${pathAdmin}/product/list`);
      return;
    }

    res.render("admin/pages/product-edit-seo", {
      pageTitle: "Edit Product SEO",
      productDetail: productDetail,
    });
  } catch (error) {
    console.log(error);
    res.redirect(`/${pathAdmin}/product/list`);
  }
}

export const editSEOPatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    const productDetail = await Product.findOne({
      _id: id,
      deleted: false,
    });

    if (!productDetail) {
      res.json({
        code: "error",
        message: "Product does not exist!",
      });
      return;
    }

    const seoTitle = req.body.seoTitle || productDetail.name;
    const seoDescription = req.body.seoDescription || "";
    const seoKeywords = req.body.seoKeywords ? JSON.parse(req.body.seoKeywords) : productDetail.tags;
    const seoRobotsIndex = req.body.seoRobotsIndex == "true" ? true : false;
    const seoRobotsFollow = req.body.seoRobotsFollow === "true" ? true : false;
    const seoOgTitle = req.body.seoOgTitle || seoTitle;
    const seoOgDescription = req.body.seoOgDescription || seoDescription;
    const seoOgImage = req.body.seoOgImage || productDetail.images[0];

    const seoData = {
      title: seoTitle,
      description: seoDescription,
      keywords: seoKeywords,
      robots: {
        index: seoRobotsIndex,
        follow: seoRobotsFollow,
      },
      og: {
        title: seoOgTitle,
        description: seoOgDescription,
        image: seoOgImage,
      },
    };

    await Product.updateOne(
      {
        _id: id,
        deleted: false,
      },
      {
        seo: seoData,
      }
    );

    res.json({
      code: "success",
      message: "Product SEO updated successfully!",
    });
  } catch (error) {
    console.log(error);
    res.json({
      code: "error",
      message: "Invalid ID!",
    });
  }
};
export const destroyManyDelete = async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body.ids;
    if (!ids || !ids.length) {
      res.json({ code: "error", message: "No items selected!" });
      return;
    }
    const productIds = ids.map(String);
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await Product.deleteMany({ _id: { $in: ids } }, { session });
        await Review.deleteMany({ productId: { $in: productIds } }, { session });
      });
    } finally {
      session.endSession();
    }
    res.json({ code: "success", message: `Deleted ${ids.length} product(s) permanently!` });
  } catch (error) {
    res.json({ code: "error", message: "Invalid data!" });
  }
};

export const trash = async (req: Request, res: Response) => {
  const recordList: any = await Product.find({ deleted: true }).select("_id name slug images status deletedAt").sort({ deletedAt: "desc" });
  res.render("admin/pages/product-trash", { pageTitle: "Product Trash", recordList });
};

export const undoPatch = async (req: Request, res: Response) => {
  try {
    await Product.updateOne({ _id: req.params.id }, { deleted: false });
    res.json({ code: "success", message: "Restored successfully!" });
  } catch (error) {
    res.json({ code: "error", message: "Invalid ID!" });
  }
};

export const destroyDelete = async (req: Request, res: Response) => {
  try {
    const productId = String(req.params.id);
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await Product.deleteOne({ _id: productId }, { session });
        await Review.deleteMany({ productId }, { session });
      });
    } finally {
      session.endSession();
    }
    res.json({ code: "success", message: "Deleted permanently!" });
  } catch (error) {
    res.json({ code: "error", message: "Invalid ID!" });
  }
};

export const deleteManyPatch = async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body.ids;
    if (!ids || !ids.length) { res.json({ code: "error", message: "No items selected!" }); return; }
    await Product.updateMany({ _id: { $in: ids } }, { deleted: true, deletedAt: new Date() });
    res.json({ code: "success", message: `Moved ${ids.length} product(s) to trash!` });
  } catch (error) {
    res.json({ code: "error", message: "Invalid data!" });
  }
};

export const undoManyPatch = async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body.ids;
    if (!ids || !ids.length) { res.json({ code: "error", message: "No items selected!" }); return; }
    await Product.updateMany({ _id: { $in: ids } }, { deleted: false });
    res.json({ code: "success", message: `Restored ${ids.length} product(s)!` });
  } catch (error) {
    res.json({ code: "error", message: "Invalid data!" });
  }
};

export const changeMultiPatch = async (req: Request, res: Response) => {
  try {
    const { value, ids } = req.body;
    if (!value || !ids || !ids.length) { res.json({ code: "error", message: "Invalid data!" }); return; }
    switch (value) {
      case "undo":
        await Product.updateMany({ _id: { $in: ids } }, { deleted: false });
        res.json({ code: "success", message: `Restored ${ids.length} product(s)!` });
        break;
      case "destroy": {
        const productIds = ids.map(String);
        const session = await mongoose.startSession();
        try {
          await session.withTransaction(async () => {
            await Product.deleteMany({ _id: { $in: ids } }, { session });
            await Review.deleteMany({ productId: { $in: productIds } }, { session });
          });
        } finally {
          session.endSession();
        }
        res.json({ code: "success", message: `Permanently deleted ${ids.length} product(s)!` });
        break;
      }
      default:
        res.json({ code: "error", message: "Invalid action!" });
    }
  } catch (error) {
    res.json({ code: "error", message: "Invalid data!" });
  }
};

export const changeMultiCategoryPatch = async (req: Request, res: Response) => {
  try {
    const { value, ids } = req.body;
    if (!value || !ids || !ids.length) { res.json({ code: "error", message: "Invalid data!" }); return; }
    switch (value) {
      case "undo":
        await CategoryProduct.updateMany({ _id: { $in: ids } }, { deleted: false });
        res.json({ code: "success", message: `Restored ${ids.length} category(s)!` });
        break;
      case "destroy":
        await CategoryProduct.deleteMany({ _id: { $in: ids } });
        res.json({ code: "success", message: `Permanently deleted ${ids.length} category(s)!` });
        break;
      default:
        res.json({ code: "error", message: "Invalid action!" });
    }
  } catch (error) {
    res.json({ code: "error", message: "Invalid data!" });
  }
};

export const deleteManyCategory = async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body.ids;
    if (!ids || !ids.length) { res.json({ code: "error", message: "No items selected!" }); return; }
    await CategoryProduct.updateMany({ _id: { $in: ids } }, { deleted: true, deletedAt: new Date() });
    res.json({ code: "success", message: `Moved ${ids.length} category(s) to trash!` });
  } catch (error) {
    res.json({ code: "error", message: "Invalid data!" });
  }
};

export const undoManyCategoryPatch = async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body.ids;
    if (!ids || !ids.length) { res.json({ code: "error", message: "No items selected!" }); return; }
    await CategoryProduct.updateMany({ _id: { $in: ids } }, { deleted: false });
    res.json({ code: "success", message: `Restored ${ids.length} category(s)!` });
  } catch (error) {
    res.json({ code: "error", message: "Invalid data!" });
  }
};

export const destroyManyCategoryDelete = async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body.ids;
    if (!ids || !ids.length) { res.json({ code: "error", message: "No items selected!" }); return; }
    await CategoryProduct.deleteMany({ _id: { $in: ids } });
    res.json({ code: "success", message: `Permanently deleted ${ids.length} category(s)!` });
  } catch (error) {
    res.json({ code: "error", message: "Invalid data!" });
  }
};
