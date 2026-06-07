import { NextFunction, Request, Response } from "express";
import Joi from "joi";

export const createCategoryPost = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
    name: Joi.string()
      .required()
      .messages({
        "string.empty": "Please enter category name!"
      }),
    slug: Joi.string()
      .required()
      .messages({
        "string.empty": "Please enter slug!"
      }),
    parent: Joi.string().allow(''),
    status: Joi.string().allow(''),
    avatar: Joi.string().allow(''),
    description: Joi.string().allow(''),
  })

  const { error } = schema.validate(req.body);

  if(error) {
    const errorMessage = error.details[0].message;

    res.json({
      code: "error",
      message: errorMessage
    })
    return;
  }

  next();
}

export const createPost = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
    name: Joi.string()
      .required()
      .messages({
        "string.empty": "Please enter product name!"
      }),
    slug: Joi.string()
      .required()
      .messages({
        "string.empty": "Please enter slug!"
      }),
    position: Joi.string().allow(''),
    status: Joi.string().allow(''),
    category: Joi.string().allow(''),
    description: Joi.string().allow(''),
    content: Joi.string().allow(''),
    images: Joi.string().allow(''),
    priceOld: Joi.string().allow(''),
    priceNew: Joi.string().allow(''),
    attributes: Joi.string().allow(''),
    variants: Joi.string().allow(''),
    stock: Joi.string().allow(''),
    tags: Joi.string().allow(''),
    boughtTogether: Joi.string().allow(''),
  });

  const { error } = schema.validate(req.body);

  if(error) {
    const errorMessage = error.details[0].message;

    res.json({
      code: "error",
      message: errorMessage
    });
    return;
  }

  next();
}

export const createAttributePost = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
    name: Joi.string()
      .required()
      .messages({
        "string.empty": "Please enter attribute name!"
      }),
    type: Joi.string().allow(''),
    options: Joi.string().allow(''),
  });

  const { error } = schema.validate(req.body);

  if(error) {
    const errorMessage = error.details[0].message;

    res.json({
      code: "error",
      message: errorMessage
    });
    return;
  }

  next();
}

export const importCSVPost = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
    mimetype: Joi.string()
      .valid("text/csv")
      .required()
      .messages({
        "string.empty": "Please upload a CSV file!",
        "any.only": "Only CSV files are accepted!"
      }),
  });

  const { error } = schema.validate({
    mimetype: req.file?.mimetype
  });

  if(error) {
    const errorMessage = error.details[0].message;

    res.json({
      code: "error",
      message: errorMessage
    });
    return;
  }

  next();
}

export const editSEOPatch = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
    seoTitle: Joi.string()
      .max(60)
      .allow("")
      .messages({
        "string.max": "SEO Title must not exceed 60 characters!",
      }),
    seoDescription: Joi.string()
      .max(160)
      .allow("")
      .messages({
        "string.max": "SEO Description must not exceed 160 characters!",
      }),
    seoKeywords: Joi.string().allow(""),
    seoRobotsIndex: Joi.string().allow(""),
    seoRobotsFollow: Joi.string().allow(""),
    seoOgTitle: Joi.string()
      .max(95)
      .allow("")
      .messages({
        "string.max": "OG Title must not exceed 95 characters!",
      }),
    seoOgDescription: Joi.string()
      .max(200)
      .allow("")
      .messages({
        "string.max": "OG Description must not exceed 200 characters!",
      }),
    seoOgImage: Joi.string().allow(""),
  });

  const { error } = schema.validate(req.body);

  if(error) {
    const errorMessage = error.details[0].message;

    res.json({
      code: "error",
      message: errorMessage
    });
    return;
  }

  next();
};