import { Request, Response } from 'express';
import * as searchService from '../../services/client/search.service';

export const search = async (req: Request, res: Response) => {
  try {
    const keyword = `${req.query.keyword || ""}`;
    const page = req.query.page;

    const data = await searchService.searchProductsAndArticles(keyword, page);

    res.render("client/pages/search-results", {
      pageTitle: data.keyword ? `Search: "${data.keyword}"` : "Search Results",
      ...data
    });
  } catch (error) {
    console.error("search error:", error);
    res.redirect("/");
  }
};
