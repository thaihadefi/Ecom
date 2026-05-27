import { Request, Response } from 'express';
import CategoryBlog from '../../models/category-blog.model';
import Blog from '../../models/blog.model';
import moment from 'moment';
import AccountAdmin from '../../models/account-admin.model';
import { PAGINATION } from '../../configs/pagination.config';
import { getPagination } from '../../helpers/pagination.helper';

export const articleByCategory = async (req: Request, res: Response) => {
  try {
    const categoryDetail = await CategoryBlog.findOne({
      slug: req.params.slug,
      deleted: false,
      status: "active"
    })

    if(!categoryDetail) {
      res.redirect("/");
      return;
    }

    // Increase category view count
    const viewed = `viewed_article_category_${categoryDetail.id}`;
    res.cookie(viewed, "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 60 * 1000 // 30 minutes
    });
    if(!req.cookies[viewed]) {
      await CategoryBlog.updateOne({
        _id: categoryDetail.id,
        deleted: false,
        status: "active"
      }, {
        $inc: { view: 1 }
      });
      categoryDetail.view = (categoryDetail.view || 0) + 1;
    }

    const find: {
      category: string,
      status: string,
      deleted: boolean
    } = {
      category: categoryDetail.id,
      status: "published",
      deleted: false
    };

    // Pagination
    const limitItems = PAGINATION.CLIENT_LIMIT;
    const totalRecord = await Blog.countDocuments(find);
    const pagination = getPagination(req.query.page, limitItems, totalRecord);
    // End Pagination

    const articleList: any = await Blog
      .find(find)
      .select("name avatar slug category createdBy updatedBy createdAt updatedAt")
      .limit(limitItems)
      .skip(pagination.skip)
      .sort({ createdAt: "desc" })

    const adminIds1 = [...new Set(articleList.map((i: any) => String(i.updatedBy || i.createdBy)).filter(Boolean))];
    const adminMap1 = new Map<string, string>();
    if (adminIds1.length > 0) {
      const admins = await AccountAdmin.find({ _id: { $in: adminIds1 } }).select("_id fullName");
      for (const a of admins as any[]) adminMap1.set(String(a._id), a.fullName);
    }
    for (const item of articleList) {
      const id = item.updatedBy || item.createdBy;
      const name = id ? adminMap1.get(String(id)) : undefined;
      if (name) {
        item.authorName = name;
        item.date = moment(item.updatedBy ? item.updatedAt : item.createdAt).format("DD/MM/YYYY");
      }
    }

    res.render("client/pages/article-by-category", {
      pageTitle: categoryDetail.name,
      categoryDetail: categoryDetail,
      articleList: articleList,
      pagination: pagination
    });
  } catch (error) {
    console.log(error);
  }
}

export const articleList = async (req: Request, res: Response) => {
  try {
    const find = {
      status: "published",
      deleted: false
    };

    const limitItems = PAGINATION.CLIENT_LIMIT;
    const totalRecord = await Blog.countDocuments(find);
    const pagination = getPagination(req.query.page, limitItems, totalRecord);

    const articleList: any = await Blog
      .find(find)
      .select("name avatar slug category createdBy updatedBy createdAt updatedAt")
      .limit(limitItems)
      .skip(pagination.skip)
      .sort({ createdAt: "desc" })

    const adminIds2 = [...new Set(articleList.map((i: any) => String(i.updatedBy || i.createdBy)).filter(Boolean))];
    const adminMap2 = new Map<string, string>();
    if (adminIds2.length > 0) {
      const admins = await AccountAdmin.find({ _id: { $in: adminIds2 } }).select("_id fullName");
      for (const a of admins as any[]) adminMap2.set(String(a._id), a.fullName);
    }
    for (const item of articleList) {
      const id = item.updatedBy || item.createdBy;
      const name = id ? adminMap2.get(String(id)) : undefined;
      if (name) {
        item.authorName = name;
        item.date = moment(item.updatedBy ? item.updatedAt : item.createdAt).format("DD/MM/YYYY");
      }
    }

    res.render("client/pages/article-list", {
      pageTitle: "Articles",
      articleList: articleList,
      pagination: pagination
    });
  } catch (error) {
    console.log(error);
  }
}

export const detail = async (req: Request, res: Response) => {
  const articleDetail: any = await Blog.findOne({
    slug: req.params.slug,
    deleted: false,
    status: "published"
  })

  if(!articleDetail) {
    res.redirect("/");
    return;
  }

  if(articleDetail.updatedBy) {
    const accountInfo = await AccountAdmin.findOne({
      _id: articleDetail.updatedBy
    }).select("_id fullName")
    if(accountInfo) {
      articleDetail.authorName = accountInfo.fullName;
      articleDetail.date = moment(articleDetail.updatedAt).format("DD/MM/YYYY");
    }
  } else {
    const accountInfo = await AccountAdmin.findOne({
      _id: articleDetail.createdBy
    }).select("_id fullName")
    if(accountInfo) {
      articleDetail.authorName = accountInfo.fullName;
      articleDetail.date = moment(articleDetail.createdAt).format("DD/MM/YYYY");
    }
  }

  // Increase view count
  const viewed = `viewed_${articleDetail.id}`;
  res.cookie(viewed, "true", {
    httpOnly: true,
    secure: process.env.NODE_ENV == "production",
    sameSite: "strict",
    maxAge: 30 * 60 * 1000 // 30 minutes
  })
  if(!req.cookies[viewed]) {
    await Blog.updateOne({
      slug: req.params.slug,
      deleted: false,
      status: "published"
    }, {
      $inc: { view: 1 } // increment by 1
    })
    articleDetail.view = (articleDetail.view || 0) + 1;
  }

  res.render("client/pages/article-detail", {
    pageTitle: articleDetail.name,
    articleDetail: articleDetail,
  });
}