import { toSearchText } from '../../helpers/slugify.helper';
import { escapeRegex } from '../../helpers/generate.helper';
import { Request, Response } from 'express';
import CategoryBlog from '../../models/category-blog.model';
import { buildCategoryTree } from '../../helpers/category.helper';
import { pathAdmin } from '../../configs/variable.config';
import Blog from '../../models/blog.model';
import { logAdminAction } from '../../helpers/log.helper';
import { RequestAccount } from '../../interfaces/request.interface';
import { pingGoogleSitemap } from '../../helpers/ping-google.helper';
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
  const totalRecord = await CategoryBlog.countDocuments(find);
  const pagination = getPagination(req.query.page, limitItems, totalRecord);
  // End Pagination

  const recordList: any = await CategoryBlog
    .find(find)
    .select("_id name slug parent avatar status view")
    .sort({ createdAt: "desc" })
    .limit(limitItems)
    .skip(pagination.skip)

  const parentIds = [...new Set(recordList.filter((i: any) => i.parent).map((i: any) => String(i.parent)))];
  if (parentIds.length > 0) {
    const parents = await CategoryBlog.find({ _id: { $in: parentIds } }).select("name");
    const parentMap = new Map(parents.map((p: any) => [String(p._id), p.name]));
    for (const item of recordList) {
      if (item.parent) item.parentName = parentMap.get(String(item.parent));
    }
  }

  res.render("admin/pages/article-category", {
    pageTitle: "Manage Article Categories",
    recordList: recordList,
    pagination: pagination
  });
}

export const trashCategory = async (req: Request, res: Response) => {
  const recordList: any = await CategoryBlog.find({ deleted: true });

  const parentIds = [...new Set(recordList.filter((i: any) => i.parent).map((i: any) => String(i.parent)))];
  if (parentIds.length > 0) {
    const parents = await CategoryBlog.find({ _id: { $in: parentIds } }).select("name");
    const parentMap = new Map(parents.map((p: any) => [String(p._id), p.name]));
    for (const item of recordList) {
      if (item.parent) item.parentName = parentMap.get(String(item.parent));
    }
  }
  res.render("admin/pages/article-trash-category", {
    pageTitle: "Article Categories Trash",
    recordList: recordList
  });
}

export const createCategory = async (req: Request, res: Response) => {
  const categoryList = await CategoryBlog.find({}).select("_id name slug parent status");

  const categoryTree = buildCategoryTree(categoryList);

  res.render("admin/pages/article-create-category", {
    pageTitle: "Create Article Category",
    categoryList: categoryTree
  });
}

export const createCategoryPost = async (req: Request, res: Response) => {
  try {
    const existSlug = await CategoryBlog.findOne({
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

    const newRecord = new CategoryBlog(req.body);
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
    const categoryList = await CategoryBlog.find({}).select("_id name slug parent status");

    const categoryTree = buildCategoryTree(categoryList);

    const id = req.params.id;

    const categoryDetail = await CategoryBlog.findOne({
      _id: id,
      deleted: false
    })

    if(!categoryDetail) {
      res.redirect(`/${pathAdmin}/article/category`);
      return;
    }

    res.render("admin/pages/article-edit-category", {
      pageTitle: "Edit Article Category",
      categoryList: categoryTree,
      categoryDetail: categoryDetail
    });
  } catch (error) {
    res.redirect(`/${pathAdmin}/article/category`);
  }
}

export const editCategoryPatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    const existSlug = await CategoryBlog.findOne({
      _id: { $ne: id }, // Exclude current record
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

    await CategoryBlog.updateOne({
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

    await CategoryBlog.updateOne({
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

export const undoCategoryPatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    await CategoryBlog.updateOne({
      _id: id
    }, {
      deleted: false
    })

    res.json({
      code: "success",
      message: "Category restored successfully!"
    })
  } catch (error) {
    res.json({
      code: "error",
      message: "Invalid ID!"
    })
  }
}

export const destroyCategoryDelete = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    await CategoryBlog.deleteOne({
      _id: id
    })

    res.json({
      code: "success",
      message: "Category permanently deleted!"
    })
  } catch (error) {
    res.json({
      code: "error",
      message: "Invalid ID!"
    })
  }
}

export const create = async (req: Request, res: Response) => {
  const categoryList = await CategoryBlog.find({
    deleted: false
  }).select("_id name slug parent status");

  const categoryTree = buildCategoryTree(categoryList);

  res.render("admin/pages/article-create", {
    pageTitle: "Create Article",
    categoryList: categoryTree
  });
}

export const createPost = async (req: RequestAccount, res: Response) => {
  try {
    const existSlug = await Blog.findOne({
      slug: req.body.slug
    }).select("_id")

    if(existSlug) {
      res.json({
        code: "error",
        message: "Slug already exists!"
      })
      return;
    }

    req.body.category = JSON.parse(req.body.category);

    req.body.search = toSearchText(`${req.body.name}`);

    if(req.body.status == "published") {
      req.body.publishAt = new Date();
    }

    req.body.createdBy = req.adminId;

    const newRecord = new Blog(req.body);
    await newRecord.save();

    logAdminAction(req, `Created article: ${req.body.name} (Id: ${newRecord.id})`);

    // Ping Google
    await pingGoogleSitemap();

    res.json({
      code: "success",
      message: "Article created successfully!"
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
    const keyword = toSearchText(`${req.query.keyword}`);
    const keywordRegex = new RegExp(escapeRegex(keyword), "i");
    find.search = keywordRegex;
  }

  // Pagination
  const limitItems = PAGINATION.ADMIN_LIMIT;
  const totalRecord = await Blog.countDocuments(find);
  const pagination = getPagination(req.query.page, limitItems, totalRecord);
  // End Pagination

  const recordList: any = await Blog
    .find(find)
    .select("name avatar category status createdAt updatedAt createdBy updatedBy view")
    .sort({ createdAt: "desc" })
    .limit(limitItems)
    .skip(pagination.skip)

  res.render("admin/pages/article-list", {
    pageTitle: "Manage Articles",
    recordList: recordList,
    pagination: pagination
  });
}

export const edit = async (req: Request, res: Response) => {
  try {
    const categoryList = await CategoryBlog.find({}).select("_id name slug parent status");

    const categoryTree = buildCategoryTree(categoryList);

    const id = req.params.id;

    const articleDetail = await Blog.findOne({
      _id: id,
      deleted: false
    })

    if(!articleDetail) {
      res.redirect(`/${pathAdmin}/article/list`);
      return;
    }

    res.render("admin/pages/article-edit", {
      pageTitle: "Edit Article",
      categoryList: categoryTree,
      articleDetail: articleDetail
    });
  } catch (error) {
    console.log(error);
    res.redirect(`/${pathAdmin}/article/list`);
  }
}

export const editPatch = async (req: RequestAccount, res: Response) => {
  try {
    const id = req.params.id;

    const articleDetail = await Blog.findOne({
      _id: id,
      deleted: false
    })

    if(!articleDetail) {
      res.json({
        code: "error",
        message: "Article does not exist!"
      })
      return;
    }

    const existSlug = await Blog.findOne({
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

    req.body.category = JSON.parse(req.body.category);

    req.body.search = toSearchText(`${req.body.name}`);

    if(req.body.status == "published") {
      req.body.publishAt = new Date();
    }

    req.body.updatedBy = req.adminId;

    await Blog.updateOne({
      _id: id,
      deleted: false
    }, req.body);

    logAdminAction(req, `Edited article: ${req.body.name} (Id: ${id})`);

    res.json({
      code: "success",
      message: "Article updated successfully!"
    })
  } catch (error) {
    res.json({
      code: "error",
      message: "Invalid data!"
    })
  }
}

export const deletePatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    await Blog.updateOne({
      _id: id
    }, {
      deleted: true,
      deletedAt: Date.now()
    })

    logAdminAction(req, `Deleted article: ${id}`);

    res.json({
      code: "success",
      message: "Article deleted successfully!"
    })
  } catch (error) {
    res.json({
      code: "error",
      message: "Invalid ID!"
    })
  }
}

export const editSEO = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    const articleDetail = await Blog.findOne({ _id: id, deleted: false });

    if(!articleDetail) {
      res.redirect(`/${pathAdmin}/article/list`);
      return;
    }

    res.render("admin/pages/article-edit-seo", {
      pageTitle: "Edit Article SEO",
      articleDetail: articleDetail,
    });
  } catch (error) {
    console.log(error);
    res.redirect(`/${pathAdmin}/article/list`);
  }
}

export const editSEOPatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    const articleDetail = await Blog.findOne({ _id: id, deleted: false });

    if(!articleDetail) {
      res.json({ code: "error", message: "Article does not exist!" });
      return;
    }

    const seoTitle = req.body.seoTitle || articleDetail.name;
    const seoDescription = req.body.seoDescription || "";
    const seoKeywords = req.body.seoKeywords ? JSON.parse(req.body.seoKeywords) : [];
    const seoRobotsIndex = req.body.seoRobotsIndex === "true";
    const seoRobotsFollow = req.body.seoRobotsFollow === "true";
    const seoOgTitle = req.body.seoOgTitle || seoTitle;
    const seoOgDescription = req.body.seoOgDescription || seoDescription;
    const seoOgImage = req.body.seoOgImage || articleDetail.avatar || "";

    await Blog.updateOne({ _id: id, deleted: false }, {
      seo: {
        title: seoTitle,
        description: seoDescription,
        keywords: seoKeywords,
        robots: { index: seoRobotsIndex, follow: seoRobotsFollow },
        og: { title: seoOgTitle, description: seoOgDescription, image: seoOgImage },
      }
    });

    res.json({ code: "success", message: "SEO updated successfully!" });
  } catch (error) {
    console.log(error);
    res.json({ code: "error", message: "Invalid data!" });
  }
}
export const destroyManyDelete = async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body.ids;
    if (!ids || !ids.length) {
      res.json({ code: "error", message: "No items selected!" });
      return;
    }
    await Blog.deleteMany({ _id: { $in: ids } });
    res.json({ code: "success", message: `Deleted ${ids.length} article(s) permanently!` });
  } catch (error) {
    res.json({ code: "error", message: "Invalid data!" });
  }
};

export const trash = async (req: Request, res: Response) => {
  const recordList: any = await Blog.find({ deleted: true }).select("_id name slug avatar status deletedAt").sort({ deletedAt: "desc" });
  res.render("admin/pages/article-trash", { pageTitle: "Article Trash", recordList });
};

export const undoPatch = async (req: Request, res: Response) => {
  try {
    await Blog.updateOne({ _id: req.params.id }, { deleted: false });
    res.json({ code: "success", message: "Restored successfully!" });
  } catch (error) {
    res.json({ code: "error", message: "Invalid ID!" });
  }
};

export const destroyDelete = async (req: Request, res: Response) => {
  try {
    await Blog.deleteOne({ _id: req.params.id });
    res.json({ code: "success", message: "Deleted permanently!" });
  } catch (error) {
    res.json({ code: "error", message: "Invalid ID!" });
  }
};

export const deleteManyPatch = async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body.ids;
    if (!ids || !ids.length) { res.json({ code: "error", message: "No items selected!" }); return; }
    await Blog.updateMany({ _id: { $in: ids } }, { deleted: true, deletedAt: new Date() });
    res.json({ code: "success", message: `Moved ${ids.length} article(s) to trash!` });
  } catch (error) {
    res.json({ code: "error", message: "Invalid data!" });
  }
};

export const undoManyPatch = async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body.ids;
    if (!ids || !ids.length) { res.json({ code: "error", message: "No items selected!" }); return; }
    await Blog.updateMany({ _id: { $in: ids } }, { deleted: false });
    res.json({ code: "success", message: `Restored ${ids.length} article(s)!` });
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
        await Blog.updateMany({ _id: { $in: ids } }, { deleted: false });
        res.json({ code: "success", message: `Restored ${ids.length} article(s)!` });
        break;
      case "destroy":
        await Blog.deleteMany({ _id: { $in: ids } });
        res.json({ code: "success", message: `Permanently deleted ${ids.length} article(s)!` });
        break;
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
        await CategoryBlog.updateMany({ _id: { $in: ids } }, { deleted: false });
        res.json({ code: "success", message: `Restored ${ids.length} category(s)!` });
        break;
      case "destroy":
        await CategoryBlog.deleteMany({ _id: { $in: ids } });
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
    await CategoryBlog.updateMany({ _id: { $in: ids } }, { deleted: true, deletedAt: new Date() });
    res.json({ code: "success", message: `Moved ${ids.length} category(s) to trash!` });
  } catch (error) {
    res.json({ code: "error", message: "Invalid data!" });
  }
};

export const undoManyCategoryPatch = async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body.ids;
    if (!ids || !ids.length) { res.json({ code: "error", message: "No items selected!" }); return; }
    await CategoryBlog.updateMany({ _id: { $in: ids } }, { deleted: false });
    res.json({ code: "success", message: `Restored ${ids.length} category(s)!` });
  } catch (error) {
    res.json({ code: "error", message: "Invalid data!" });
  }
};

export const destroyManyCategoryDelete = async (req: Request, res: Response) => {
  try {
    const ids: string[] = req.body.ids;
    if (!ids || !ids.length) { res.json({ code: "error", message: "No items selected!" }); return; }
    await CategoryBlog.deleteMany({ _id: { $in: ids } });
    res.json({ code: "success", message: `Permanently deleted ${ids.length} category(s)!` });
  } catch (error) {
    res.json({ code: "error", message: "Invalid data!" });
  }
};
