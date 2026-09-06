import { Request, Response, NextFunction } from "express";
import Joi from "joi";

export const createPost = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
    fullName: Joi.string()
      .min(5)
      .max(50)
      .required()
      .messages({
        "string.empty": "Please enter your full name!",
        "string.min": "Full name must be at least 5 characters long!",
        "string.max": "Full name cannot exceed 50 characters!",
      }),
    phone: Joi.string()
      .custom((value, helpers) => {
        if(!/^(0?)(3[2-9]|5[6|8|9]|7[0|6-9]|8[0-6|8|9]|9[0-4|6-9])[0-9]{7}$/.test(value)) {
          return helpers.error('phone.valid');
        }
        return value;
      })
      .required()
      .messages({
        "string.empty": "Please enter your phone number!",
        "phone.valid": "Invalid phone number format!",
      }),
    address: Joi.string()
      .required()
      .messages({
        "string.empty": "Please enter your street name, building, or house number!",
      }),
    longitude: Joi.number()
      .required()
      .messages({
        "number.base": "Invalid address!",
        "any.required": "Please select a location on the map!"
      }),
    latitude: Joi.number()
      .required()
      .messages({
        "number.base": "Invalid address!",
        "any.required": "Please select a location on the map!"
      }),
    note: Joi.string().allow(''),
    items: Joi.array()
      .items(
        Joi.object({
          productId: Joi.string().required(),
          quantity: Joi.number().integer().min(1).required().messages({
            "number.min": "Product quantity must be at least 1!"
          }),
          variant: Joi.array().items(
            Joi.object({
              attrId: Joi.string().required(),
              value: Joi.string().required(),
              label: Joi.string().required()
            })
          ).optional()
        })
      )
      .min(1)
      .required()
      .messages({
        "array.min": "Cart cannot be empty!",
        "any.required": "Please select products!",
      }),
    coupon: Joi.string().allow(''),
    paymentMethod: Joi.string()
      .valid("money", "vnpay", "zalopay")
      .required()
      .messages({
        "any.only": "Invalid payment method!",
      }),
    shippingMethod: Joi.string()
      .required()
      .messages({
        "string.empty": "Please select a shipping method!",
      }),
    usePoint: Joi.boolean().optional(),
    usedPoint: Joi.alternatives().try(Joi.boolean(), Joi.number()).optional(),
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
