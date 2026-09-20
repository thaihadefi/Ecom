import { Request, Response } from 'express';
import * as articleService from '../../services/client/article.service';
import { alreadyViewed, claimView } from '../../helpers/view-counter.helper';
import { sendCaughtError } from '../../helpers/http-response.helper';

export const articleByCategory = async (req: Request, res: Response) => {
  try {
    const data = await articleService.getArticlesByCategory(req.params.slug, req.query.page);
    if (!data) {
      res.redirect("/");
      return;
    }

    const { categoryDetail, articleList, pagination } = data;

    if (!alreadyViewed(req, `article_category_${categoryDetail.id}`)) {
      categoryDetail.view = (categoryDetail.view || 0) + 1;
    }

    res.render("client/pages/article-by-category", {
      pageTitle: categoryDetail.name,
      categoryDetail: categoryDetail,
      articleList: articleList,
      pagination: pagination
    });
  } catch (error) {
    console.error("articleByCategory error:", error);
    res.redirect("/");
  }
};

export const articleList = async (req: Request, res: Response) => {
  try {
    const { articleList, pagination } = await articleService.getArticleList(req.query.page);

    res.render("client/pages/article-list", {
      pageTitle: "Articles",
      articleList: articleList,
      pagination: pagination
    });
  } catch (error) {
    console.error("articleList error:", error);
    res.redirect("/");
  }
};

export const detail = async (req: Request, res: Response) => {
  try {
    const articleDetail = await articleService.getArticleDetail(req.params.slug);

    if (!articleDetail) {
      res.redirect("/");
      return;
    }

    if (!alreadyViewed(req, `article_${articleDetail.id}`)) {
      articleDetail.view = (articleDetail.view || 0) + 1;
    }

    res.render("client/pages/article-detail", {
      pageTitle: articleDetail.name,
      articleDetail: articleDetail,
    });
  } catch (error) {
    console.error("article detail error:", error);
    res.redirect("/");
  }
};

export const categoryView = async (req: Request, res: Response) => {
  try {
    const id = await articleService.getCategoryIdBySlug(req.params.slug);
    if (!id) {
      res.status(404).json({ code: "error", message: "Category does not exist!" });
      return;
    }
    if (claimView(req, res, `article_category_${id}`)) await articleService.incrementCategoryView(id);
    res.json({ code: "success", message: "Success!" });
  } catch (error) {
    console.error("article category view error:", error);
    sendCaughtError(res, error, "Invalid data!");
  }
};

export const detailView = async (req: Request, res: Response) => {
  try {
    const id = await articleService.getArticleIdBySlug(req.params.slug);
    if (!id) {
      res.status(404).json({ code: "error", message: "Article does not exist!" });
      return;
    }
    if (claimView(req, res, `article_${id}`)) await articleService.incrementArticleView(req.params.slug);
    res.json({ code: "success", message: "Success!" });
  } catch (error) {
    console.error("article view error:", error);
    sendCaughtError(res, error, "Invalid data!");
  }
};
