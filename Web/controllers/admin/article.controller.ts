import { Request, Response } from 'express';
import { pathAdmin } from '../../configs/variable.config';
import { logAdminAction } from '../../helpers/log.helper';
import { RequestAccount } from '../../interfaces/request.interface';
import * as articleService from '../../services/admin/article.service';

export const category = async (req: Request, res: Response) => {
  const data = await articleService.getCategoryBlogList(req.query.keyword, req.query.page);

  res.render("admin/pages/article-category", {
    pageTitle: "Manage Article Categories",
    ...data
  });
};

export const trashCategory = async (_req: Request, res: Response) => {
  const recordList = await articleService.getCategoryBlogTrash();

  res.render("admin/pages/article-trash-category", {
    pageTitle: "Article Categories Trash",
    recordList: recordList
  });
};

export const createCategory = async (_req: Request, res: Response) => {
  const categoryTree = await articleService.getCategoryBlogTree();

  res.render("admin/pages/article-create-category", {
    pageTitle: "Create Article Category",
    categoryList: categoryTree
  });
};

export const createCategoryPost = async (req: Request, res: Response) => {
  try {
    const result = await articleService.createCategoryBlog(req.body);

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
    const categoryTree = await articleService.getCategoryBlogTree();
    const id = req.params.id;
    const categoryDetail = await articleService.getCategoryBlogById(id);

    if (!categoryDetail) {
      res.redirect(`/${pathAdmin}/article/category`);
      return;
    }

    res.render("admin/pages/article-edit-category", {
      pageTitle: "Edit Article Category",
      categoryList: categoryTree,
      categoryDetail: categoryDetail
    });
  } catch (error) {
    console.error("editCategory error:", error);
    res.redirect(`/${pathAdmin}/article/category`);
  }
};

export const editCategoryPatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const result = await articleService.updateCategoryBlog(id, req.body);

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
    const result = await articleService.softDeleteCategoryBlog(id);

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

export const undoCategoryPatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const result = await articleService.restoreCategoryBlog(id);

    res.json({
      code: "success",
      message: result.message
    });
  } catch (error) {
    console.error("undoCategoryPatch error:", error);
    res.json({
      code: "error",
      message: "Invalid ID!"
    });
  }
};

export const destroyCategoryDelete = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const result = await articleService.permanentlyDeleteCategoryBlog(id);

    res.json({
      code: "success",
      message: result.message
    });
  } catch (error) {
    console.error("destroyCategoryDelete error:", error);
    res.json({
      code: "error",
      message: "Invalid ID!"
    });
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
        const result = await articleService.restoreManyCategories(ids);
        res.json({ code: "success", message: result.message });
        break;
      }
      case "destroy": {
        const result = await articleService.permanentlyDeleteManyCategories(ids);
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
    const result = await articleService.softDeleteManyCategories(ids);
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
    const result = await articleService.restoreManyCategories(ids);
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
    const result = await articleService.permanentlyDeleteManyCategories(ids);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    console.error("destroyManyCategoryDelete error:", error);
    res.json({ code: "error", message: "Invalid data!" });
  }
};

export const create = async (_req: Request, res: Response) => {
  const categoryTree = await articleService.getCategoryBlogTree({ deleted: false });

  res.render("admin/pages/article-create", {
    pageTitle: "Create Article",
    categoryList: categoryTree
  });
};

export const createPost = async (req: RequestAccount, res: Response) => {
  try {
    const result = await articleService.createArticle(req.body, req.adminId);

    if (!result.success) {
      res.json({
        code: "error",
        message: result.message
      });
      return;
    }

    logAdminAction(req, `Created article: ${req.body.name} (Id: ${result.article?.id})`);

    res.json({
      code: "success",
      message: result.message
    });
  } catch (error) {
    console.error("createPost article error:", error);
    res.json({
      code: "error",
      message: "Invalid data!"
    });
  }
};

export const list = async (req: Request, res: Response) => {
  const data = await articleService.getArticleList(req.query.keyword, req.query.page);

  res.render("admin/pages/article-list", {
    pageTitle: "Manage Articles",
    ...data
  });
};

export const edit = async (req: Request, res: Response) => {
  try {
    const categoryTree = await articleService.getCategoryBlogTree();
    const id = req.params.id;
    const articleDetail = await articleService.getArticleById(id);

    if (!articleDetail) {
      res.redirect(`/${pathAdmin}/article/list`);
      return;
    }

    res.render("admin/pages/article-edit", {
      pageTitle: "Edit Article",
      categoryList: categoryTree,
      articleDetail: articleDetail
    });
  } catch (error) {
    console.error("edit article error:", error);
    res.redirect(`/${pathAdmin}/article/list`);
  }
};

export const editPatch = async (req: RequestAccount, res: Response) => {
  try {
    const id = req.params.id;
    const result = await articleService.updateArticle(id, req.body, req.adminId);

    if (!result.success) {
      res.json({
        code: "error",
        message: result.message
      });
      return;
    }

    logAdminAction(req, `Edited article: ${req.body.name} (Id: ${id})`);

    res.json({
      code: "success",
      message: result.message
    });
  } catch (error) {
    console.error("editPatch article error:", error);
    res.json({
      code: "error",
      message: "Invalid data!"
    });
  }
};

export const deletePatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const result = await articleService.softDeleteArticle(id);

    logAdminAction(req, `Deleted article: ${id}`);

    res.json({
      code: "success",
      message: result.message
    });
  } catch (error) {
    console.error("deletePatch article error:", error);
    res.json({
      code: "error",
      message: "Invalid ID!"
    });
  }
};

export const editSEO = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const articleDetail = await articleService.getArticleById(id);

    if (!articleDetail) {
      res.redirect(`/${pathAdmin}/article/list`);
      return;
    }

    res.render("admin/pages/article-edit-seo", {
      pageTitle: "Edit Article SEO",
      articleDetail: articleDetail,
    });
  } catch (error) {
    console.error("editSEO error:", error);
    res.redirect(`/${pathAdmin}/article/list`);
  }
};

export const editSEOPatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const result = await articleService.updateArticleSEO(id, req.body);

    res.json({
      code: result.success ? "success" : "error",
      message: result.message
    });
  } catch (error) {
    console.error("editSEOPatch error:", error);
    res.json({ code: "error", message: "Invalid data!" });
  }
};

export const destroyManyDelete = async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body.ids;
    if (!ids || !ids.length) {
      res.json({ code: "error", message: "No items selected!" });
      return;
    }
    const result = await articleService.permanentlyDeleteManyArticles(ids);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    console.error("destroyManyDelete error:", error);
    res.json({ code: "error", message: "Invalid data!" });
  }
};

export const trash = async (_req: Request, res: Response) => {
  const recordList = await articleService.getArticleTrash();
  res.render("admin/pages/article-trash", { pageTitle: "Article Trash", recordList });
};

export const undoPatch = async (req: Request, res: Response) => {
  try {
    const result = await articleService.restoreArticle(req.params.id);
    res.json({ code: "success", message: result.message });
  } catch (error) {
    console.error("undoPatch error:", error);
    res.json({ code: "error", message: "Invalid ID!" });
  }
};

export const destroyDelete = async (req: Request, res: Response) => {
  try {
    const result = await articleService.permanentlyDeleteArticle(req.params.id);
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
    const result = await articleService.softDeleteManyArticles(ids);
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
    const result = await articleService.restoreManyArticles(ids);
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
        const result = await articleService.restoreManyArticles(ids);
        res.json({ code: "success", message: result.message });
        break;
      }
      case "destroy": {
        const result = await articleService.permanentlyDeleteManyArticles(ids);
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
