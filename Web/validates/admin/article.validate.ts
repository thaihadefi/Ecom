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
        "string.empty": "Please enter article title!"
      }),
    slug: slugField(),
    category: Joi.string().allow(''),
    status: Joi.string().valid('draft', 'published', 'archived', ''),
    avatar: Joi.string().allow(''),
    description: Joi.string().allow(''),
    content: Joi.string().allow(''),
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
