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
        "string.empty": "Please enter article title!"
      }),
    slug: Joi.string()
      .required()
      .messages({
        "string.empty": "Please enter slug!"
      }),
    category: Joi.string().allow(''),
    status: Joi.string().allow(''),
    avatar: Joi.string().allow(''),
    description: Joi.string().allow(''),
    content: Joi.string().allow(''),
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
