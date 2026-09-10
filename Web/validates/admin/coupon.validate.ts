import { Request, Response, NextFunction } from "express";
import Joi from "joi";

export const createPost = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
    code: Joi.string()
      .required()
      .messages({
        "string.empty": "Please enter coupon code!"
      }),
    name: Joi.string()
      .required()
      .messages({
        "string.empty": "Please enter coupon name!"
      }),
    typeDiscount: Joi.string().valid("percentage", "fixed").allow(''),
    value: Joi.number().min(0).allow('', null).messages({
      "number.min": "Discount value must be at least 0!",
      "number.base": "Discount value must be a number!"
    }),
    minOrderValue: Joi.number().min(0).allow('', null).messages({
      "number.min": "Minimum order value must be at least 0!",
      "number.base": "Minimum order value must be a number!"
    }),
    maxDiscountValue: Joi.number().min(0).allow('', null).messages({
      "number.min": "Maximum discount value must be at least 0!",
      "number.base": "Maximum discount value must be a number!"
    }),
    usageLimit: Joi.number().integer().min(0).allow('', null).messages({
      "number.min": "Usage limit must be at least 0!",
      "number.base": "Usage limit must be a number!"
    }),
    typeDisplay: Joi.string().allow(''),
    status: Joi.string().allow(''),
    startDate: Joi.string().allow(''),
    endDate: Joi.string().allow(''),
    description: Joi.string().allow(''),
  }).custom((obj, helpers) => {
    if (obj.typeDiscount === "percentage" && obj.value !== '' && obj.value !== null && parseFloat(obj.value) > 100) {
      return helpers.message({ custom: "Percentage discount cannot exceed 100%!" });
    }
    return obj;
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
