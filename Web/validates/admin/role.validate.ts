import { Request, Response, NextFunction } from "express";
import Joi from "joi";

export const createPost = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
    name: Joi.string()
      .required()
      .messages({
        "string.empty": "Please enter role name!"
      }),
    description: Joi.string().allow(''),
    permissions: Joi.string().allow(''),
    status: Joi.string().valid('active', 'inactive', '')
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
