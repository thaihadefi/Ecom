import { Request, Response } from 'express';
import * as searchService from '../../services/client/search.service';
import * as searchQueryService from '../../services/client/search-query.service';
import { sendCaughtError } from '../../helpers/http-response.helper';

export const search = async (req: Request, res: Response) => {
  try {
    const data = await searchService.searchProductsAndArticles(req.query.keyword, req.query);

    // A page past the end (an old link, or results that shrank) lands on the last page instead of "no results".
    const { currentPage, totalPage, totalRecord } = data.pagination;
    if (totalRecord > 0 && currentPage > totalPage) {
      const url = new URL(req.originalUrl, "http://localhost");
      url.searchParams.set("page", String(totalPage));
      res.redirect(`${url.pathname}${url.search}`);
      return;
    }

    const filterKeys = ["price", "onSale", "inStock", "rating"];
    const hasFilters = Object.keys(req.query).some((key) => filterKeys.includes(key) || key.startsWith("attribute_"));

    // Only the plain first-page search counts toward popular searches; paging and filtering are the same intent.
    if (data.keyword && data.pagination.currentPage === 1 && !hasFilters && !req.query.sort) {
      searchQueryService.recordSearch(data.keyword, data.pagination.totalRecord, req.ip || "unknown");
    }

    res.render("client/pages/search-results", {
      pageTitle: data.keyword ? `Search: "${data.keyword}"` : "Search",
      hasFilters,
      ...data
    });
  } catch (error) {
    console.error("search error:", error);
    res.redirect("/");
  }
};

export const popular = async (_req: Request, res: Response) => {
  try {
    res.json({
      code: "success",
      message: "Success!",
      list: await searchQueryService.getPopularSearches()
    });
  } catch (error) {
    console.error("popular searches error:", error);
    sendCaughtError(res, error, "Failed!", "Failed!");
  }
};
