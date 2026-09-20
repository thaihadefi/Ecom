import { NextFunction, Request, Response } from "express";
import Joi from "joi";
import { slugField } from "./common.validate";

export const createCategoryPost = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
    name: Joi.string()
      .required()
      .messages({
        "string.empty": "Please enter category name!"
      }),
    slug: slugField(),
    parent: Joi.string().allow(''),
    status: Joi.string().valid('active', 'inactive', ''),
    avatar: Joi.string().allow(''),
    description: Joi.string().allow(''),
  })

  const { error } = schema.validate(req.body);

  if(error) {
    const errorMessage = error.details[0].message;

    res.status(400).json({
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
    slug: slugField(),
    position: Joi.string().pattern(/^\d{1,9}$/).allow(''),
    status: Joi.string().valid('draft', 'active', 'inactive', ''),
    category: Joi.string().allow(''),
    description: Joi.string().allow(''),
    content: Joi.string().allow(''),
    images: Joi.string().allow(''),
    priceOld: Joi.string().pattern(/^\d{1,12}$/).allow('').messages({ "string.pattern.base": "Old price must be a non-negative whole number!" }),
    priceNew: Joi.string().pattern(/^\d{1,12}$/).allow('').messages({ "string.pattern.base": "Price must be a non-negative whole number!" }),
    attributes: Joi.string().allow(''),
    variants: Joi.string().allow(''),
    stock: Joi.string().pattern(/^\d{1,9}$/).allow('').messages({ "string.pattern.base": "Stock must be a non-negative whole number!" }),
    tags: Joi.string().allow(''),
    boughtTogether: Joi.string().allow(''),
  });

  const { error } = schema.validate(req.body);

  if(error) {
    const errorMessage = error.details[0].message;

    res.status(400).json({
      code: "error",
      message: errorMessage
    });
    return;
  }

  if (req.body.variants) {
    const variantsError = checkVariants(req.body.variants);
    if (variantsError) {
      res.status(400).json({ code: "error", message: variantsError });
      return;
    }
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
    type: Joi.string().valid('text', 'select', 'color', ''),
    options: Joi.string().allow(''),
  });

  const { error } = schema.validate(req.body);

  if(error) {
    const errorMessage = error.details[0].message;

    res.status(400).json({
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

    res.status(400).json({
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

    res.status(400).json({
      code: "error",
      message: errorMessage
    });
    return;
  }

  next();
};

const isWholeNonNegative = (value: unknown): boolean =>
  value === undefined || value === null || value === "" || (Number.isFinite(Number(value)) && Number(value) >= 0);

const checkVariants = (raw: string): string | null => {
  let variants: unknown;
  try {
    variants = JSON.parse(raw);
  } catch {
    return "Invalid product variants!";
  }
  if (!Array.isArray(variants)) return "Invalid product variants!";
  const valid = variants.every((variant) =>
    variant && typeof variant === "object" &&
    [variant.price, variant.priceOld, variant.priceNew, variant.stock].every(isWholeNonNegative)
  );
  return valid ? null : "Variant prices and stock must be non-negative numbers!";
};
