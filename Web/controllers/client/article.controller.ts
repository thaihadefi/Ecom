import { Request, Response } from 'express';
import * as articleService from '../../services/client/article.service';

export const articleByCategory = async (req: Request, res: Response) => {
  try {
    const data = await articleService.getArticlesByCategory(req.params.slug, req.query.page);
    if (!data) {
      res.redirect("/");
      return;
    }

    const { categoryDetail, articleList, pagination } = data;

    const viewed = `viewed_article_category_${categoryDetail.id}`;
    res.cookie(viewed, "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 60 * 1000
    });
    if (!req.cookies[viewed]) {
      void articleService.incrementCategoryView(categoryDetail.id).catch((err) => console.error("incrementCategoryView error:", err));
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

    const viewed = `viewed_${articleDetail.id}`;
    res.cookie(viewed, "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 60 * 1000
    });
    if (!req.cookies[viewed]) {
      void articleService.incrementArticleView(req.params.slug).catch((err) => console.error("incrementArticleView error:", err));
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
