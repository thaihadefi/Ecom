import { Request, Response } from 'express';
import { pathAdmin } from '../../configs/variable.config';
import { Parser } from 'json2csv';
import { logAdminAction } from '../../helpers/log.helper';
import * as categoryProductService from '../../services/admin/category-product.service';
import * as attributeProductService from '../../services/admin/attribute-product.service';
import * as productService from '../../services/admin/product.service';

export const category = async (req: Request, res: Response) => {
  const data = await categoryProductService.getCategoryProductList(req.query.keyword, req.query.page);

  res.render("admin/pages/product-category", {
    pageTitle: "Product Category Management",
    ...data
  });
};

export const createCategory = async (_req: Request, res: Response) => {
  const categoryTree = await categoryProductService.getCategoryProductTree();

  res.render("admin/pages/product-create-category", {
    pageTitle: "Create Product Category",
    categoryList: categoryTree
  });
};

export const createCategoryPost = async (req: Request, res: Response) => {
  try {
    const result = await categoryProductService.createCategoryProduct(req.body);

    res.json({
      code: result.success ? "success" : "error",
      message: result.message
    });
  } catch (error) {
    console.error("createCategoryPost error:", error);
    res.json({
      code: "error",
      message: "Invalid data!"
    });
  }
};

export const editCategory = async (req: Request, res: Response) => {
  try {
    const categoryTree = await categoryProductService.getCategoryProductTree();
    const id = req.params.id;
    const categoryDetail = await categoryProductService.getCategoryProductById(id);

    if (!categoryDetail) {
      res.redirect(`/${pathAdmin}/product/category`);
      return;
    }

    res.render("admin/pages/product-edit-category", {
      pageTitle: "Edit Product Category",
      categoryList: categoryTree,
      categoryDetail: categoryDetail
    });
  } catch (error) {
    console.error("editCategory error:", error);
    res.redirect(`/${pathAdmin}/product/category`);
  }
};

export const editCategoryPatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const result = await categoryProductService.updateCategoryProduct(id, req.body);

    res.json({
      code: result.success ? "success" : "error",
      message: result.message
    });
  } catch (error) {
    console.error("editCategoryPatch error:", error);
    res.json({
      code: "error",
      message: "Invalid data!"
    });
  }
};

export const deleteCategoryPatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const result = await categoryProductService.softDeleteCategoryProduct(id);

    res.json({
      code: "success",
      message: result.message
    });
  } catch (error) {
    console.error("deleteCategoryPatch error:", error);
    res.json({
      code: "error",
      message: "Invalid ID!"
    });
  }
};

export const trashCategory = async (_req: Request, res: Response) => {
  const recordList = await categoryProductService.getCategoryProductTrash();

  res.render("admin/pages/product-category-trash", {
    pageTitle: "Product Category Trash",
    recordList: recordList
  });
};

export const undoCategoryPatch = async (req: Request, res: Response) => {
  try {
    const result = await categoryProductService.restoreCategoryProduct(req.params.id);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    console.error("undoCategoryPatch error:", error);
    res.json({ code: "error", message: "Invalid ID!" });
  }
};

export const destroyCategoryDelete = async (req: Request, res: Response) => {
  try {
    const result = await categoryProductService.permanentlyDeleteCategoryProduct(req.params.id);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    console.error("destroyCategoryDelete error:", error);
    res.json({ code: "error", message: "Invalid ID!" });
  }
};

export const changeMultiCategoryPatch = async (req: Request, res: Response) => {
  try {
    const { value, ids } = req.body;
    if (!value || !ids || !ids.length) {
      res.json({ code: "error", message: "Invalid data!" });
      return;
    }
    switch (value) {
      case "undo": {
        const result = await categoryProductService.restoreManyCategoryProducts(ids);
        res.json({ code: "success", message: result.message });
        break;
      }
      case "destroy": {
        const result = await categoryProductService.permanentlyDeleteManyCategoryProducts(ids);
        res.json({ code: "success", message: result.message });
        break;
      }
      default:
        res.json({ code: "error", message: "Invalid action!" });
    }
  } catch (error) {
    console.error("changeMultiCategoryPatch error:", error);
    res.json({ code: "error", message: "Invalid data!" });
  }
};

export const deleteManyCategory = async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body.ids;
    if (!ids || !ids.length) {
      res.json({ code: "error", message: "No items selected!" });
      return;
    }
    const result = await categoryProductService.softDeleteManyCategoryProducts(ids);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    console.error("deleteManyCategory error:", error);
    res.json({ code: "error", message: "Invalid data!" });
  }
};

export const undoManyCategoryPatch = async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body.ids;
    if (!ids || !ids.length) {
      res.json({ code: "error", message: "No items selected!" });
      return;
    }
    const result = await categoryProductService.restoreManyCategoryProducts(ids);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    console.error("undoManyCategoryPatch error:", error);
    res.json({ code: "error", message: "Invalid data!" });
  }
};

export const destroyManyCategoryDelete = async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body.ids;
    if (!ids || !ids.length) {
      res.json({ code: "error", message: "No items selected!" });
      return;
    }
    const result = await categoryProductService.permanentlyDeleteManyCategoryProducts(ids);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    console.error("destroyManyCategoryDelete error:", error);
    res.json({ code: "error", message: "Invalid data!" });
  }
};

export const attribute = async (req: Request, res: Response) => {
  const data = await attributeProductService.getAttributeProductList(req.query.keyword, req.query.page);

  res.render("admin/pages/product-attribute", {
    pageTitle: "Product Attribute Management",
    ...data
  });
};

export const createAttribute = async (_req: Request, res: Response) => {
  res.render("admin/pages/product-create-attribute", {
    pageTitle: "Create Product Attribute"
  });
};

export const createAttributePost = async (req: Request, res: Response) => {
  try {
    const result = await attributeProductService.createAttributeProduct(req.body);

    res.json({
      code: "success",
      message: result.message
    });
  } catch (error) {
    console.error("createAttributePost error:", error);
    res.json({
      code: "error",
      message: "Invalid data!"
    });
  }
};

export const editAttribute = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const attributeDetail = await attributeProductService.getAttributeProductById(id);

    if (!attributeDetail) {
      res.redirect(`/${pathAdmin}/product/attribute`);
      return;
    }

    res.render("admin/pages/product-edit-attribute", {
      pageTitle: "Edit Product Attribute",
      attributeDetail: attributeDetail
    });
  } catch (error) {
    console.error("editAttribute error:", error);
    res.redirect(`/${pathAdmin}/product/attribute`);
  }
};

export const editAttributePatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const result = await attributeProductService.updateAttributeProduct(id, req.body);

    res.json({
      code: "success",
      message: result.message
    });
  } catch (error) {
    console.error("editAttributePatch error:", error);
    res.json({
      code: "error",
      message: "Invalid data!"
    });
  }
};

export const deleteAttributePatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const result = await attributeProductService.softDeleteAttributeProduct(id);

    res.json({
      code: "success",
      message: result.message
    });
  } catch (error) {
    console.error("deleteAttributePatch error:", error);
    res.json({
      code: "error",
      message: "Invalid ID!"
    });
  }
};

export const trashAttribute = async (_req: Request, res: Response) => {
  const recordList = await attributeProductService.getAttributeProductTrash();

  res.render("admin/pages/product-attribute-trash", {
    pageTitle: "Product Attribute Trash",
    recordList: recordList
  });
};

export const undoAttributePatch = async (req: Request, res: Response) => {
  try {
    const result = await attributeProductService.restoreAttributeProduct(req.params.id);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    console.error("undoAttributePatch error:", error);
    res.json({ code: "error", message: "Invalid ID!" });
  }
};

export const destroyAttributeDelete = async (req: Request, res: Response) => {
  try {
    const result = await attributeProductService.permanentlyDeleteAttributeProduct(req.params.id);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    console.error("destroyAttributeDelete error:", error);
    res.json({ code: "error", message: "Invalid ID!" });
  }
};

export const create = async (_req: Request, res: Response) => {
  const data = await productService.getProductCreateContext();

  res.render("admin/pages/product-create", {
    pageTitle: "Create Product",
    ...data
  });
};

export const createPost = async (req: Request, res: Response) => {
  try {
    const result = await productService.createProduct(req.body);

    if (!result.success) {
      res.json({
        code: "error",
        message: result.message
      });
      return;
    }

    logAdminAction(req, `Created product: ${req.body.name} (Id: ${result.product?.id})`);

    res.json({
      code: "success",
      message: result.message
    });
  } catch (error) {
    console.error("createPost product error:", error);
    res.json({
      code: "error",
      message: "Invalid data!"
    });
  }
};

export const list = async (req: Request, res: Response) => {
  const data = await productService.getProductList(req.query.keyword, req.query.page);

  res.render("admin/pages/product-list", {
    pageTitle: "Product Management",
    ...data
  });
};

export const edit = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const data = await productService.getProductEditContext(id);

    if (!data) {
      res.redirect(`/${pathAdmin}/product/list`);
      return;
    }

    res.render("admin/pages/product-edit", {
      pageTitle: "Edit Product",
      ...data
    });
  } catch (error) {
    console.error("edit product error:", error);
    res.redirect(`/${pathAdmin}/product/list`);
  }
};

export const editPatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const result = await productService.updateProduct(id, req.body);

    if (!result.success) {
      res.json({
        code: "error",
        message: result.message
      });
      return;
    }

    logAdminAction(req, `Edited product: ${result.product?.name} (Id: ${result.product?.id})`);

    res.json({
      code: "success",
      message: result.message
    });
  } catch (error) {
    console.error("editPatch product error:", error);
    res.json({
      code: "error",
      message: "Invalid data!"
    });
  }
};

export const deletePatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const result = await productService.softDeleteProduct(id);

    res.json({
      code: "success",
      message: result.message
    });
  } catch (error) {
    console.error("deletePatch product error:", error);
    res.json({
      code: "error",
      message: "Invalid ID!"
    });
  }
};

export const exportCSV = async (_req: Request, res: Response) => {
  try {
    res.header('Content-Type', 'text/csv');
    res.attachment('products.csv');
    res.write('\ufeff');

    const BATCH = 500;
    let skip = 0;
    let headerWritten = false;
    const parser = new Parser({ header: true });

    while (true) {
      const batch = await productService.getProductsBatchForExport(skip, BATCH);
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
    console.error("exportCSV error:", error);
  }
};

export const importCSVPost = async (req: Request, res: Response) => {
  try {
    if (!req.file?.buffer) {
      res.json({ code: "error", message: "No file uploaded!" });
      return;
    }

    await productService.bulkImportProductsFromCsv(req.file.buffer.toString("utf-8"));

    res.json({
      code: "success",
      message: "File uploaded successfully!"
    });
  } catch (error) {
    console.error("importCSVPost error:", error);
    res.json({
      code: "error",
      message: "Invalid data!"
    });
  }
};

export const editSEO = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const productDetail = await productService.getProductDetail(id);

    if (!productDetail) {
      res.redirect(`/${pathAdmin}/product/list`);
      return;
    }

    res.render("admin/pages/product-edit-seo", {
      pageTitle: "Edit Product SEO",
      productDetail: productDetail,
    });
  } catch (error) {
    console.error("editSEO error:", error);
    res.redirect(`/${pathAdmin}/product/list`);
  }
};

export const editSEOPatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const result = await productService.updateProductSEO(id, req.body);

    res.json({
      code: result.success ? "success" : "error",
      message: result.message
    });
  } catch (error) {
    console.error("editSEOPatch error:", error);
    res.json({
      code: "error",
      message: "Invalid ID!"
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

    const result = await productService.permanentlyDeleteManyProducts(ids);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    console.error("destroyManyDelete error:", error);
    res.json({ code: "error", message: "Invalid data!" });
  }
};

export const trash = async (_req: Request, res: Response) => {
  const recordList = await productService.getProductTrash();
  res.render("admin/pages/product-trash", { pageTitle: "Product Trash", recordList });
};

export const undoPatch = async (req: Request, res: Response) => {
  try {
    const result = await productService.restoreProduct(req.params.id);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    console.error("undoPatch error:", error);
    res.json({ code: "error", message: "Invalid ID!" });
  }
};

export const destroyDelete = async (req: Request, res: Response) => {
  try {
    const result = await productService.permanentlyDeleteProduct(req.params.id);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    console.error("destroyDelete error:", error);
    res.json({ code: "error", message: "Invalid ID!" });
  }
};

export const deleteManyPatch = async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body.ids;
    if (!ids || !ids.length) {
      res.json({ code: "error", message: "No items selected!" });
      return;
    }

    const result = await productService.softDeleteManyProducts(ids);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    console.error("deleteManyPatch error:", error);
    res.json({ code: "error", message: "Invalid data!" });
  }
};

export const undoManyPatch = async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body.ids;
    if (!ids || !ids.length) {
      res.json({ code: "error", message: "No items selected!" });
      return;
    }

    const result = await productService.restoreManyProducts(ids);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    console.error("undoManyPatch error:", error);
    res.json({ code: "error", message: "Invalid data!" });
  }
};

export const changeMultiPatch = async (req: Request, res: Response) => {
  try {
    const { value, ids } = req.body;
    if (!value || !ids || !ids.length) {
      res.json({ code: "error", message: "Invalid data!" });
      return;
    }
    switch (value) {
      case "undo": {
        const result = await productService.restoreManyProducts(ids);
        res.json({ code: "success", message: result.message });
        break;
      }
      case "destroy": {
        const result = await productService.permanentlyDeleteManyProducts(ids);
        res.json({ code: "success", message: result.message });
        break;
      }
      default:
        res.json({ code: "error", message: "Invalid action!" });
    }
  } catch (error) {
    console.error("changeMultiPatch error:", error);
    res.json({ code: "error", message: "Invalid data!" });
  }
};
