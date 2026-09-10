import { Request, Response, NextFunction } from "express";
import Joi from "joi";

export const profileEditPatch = (req: Request, res: Response, next: NextFunction) => {
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
      .allow('')
      .custom((value, helpers) => {
        if(!/^(0?)(3[2-9]|5[6|8|9]|7[0|6-9]|8[0-6|8|9]|9[0-4|6-9])[0-9]{7}$/.test(value)) {
          return helpers.error('phone.valid');
        }
        return value;
      })
      .messages({
        "phone.valid": "Invalid phone number format!",
      }),
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

export const changeEmailRequest = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
    newEmail: Joi.string()
      .email()
      .required()
      .messages({
        "string.empty": "Please enter your new email!",
        "string.email": "Invalid email format!",
        "any.required": "Please enter your new email!",
      }),
  });
  const { error } = schema.validate(req.body);
  if (error) {
    res.json({ code: "error", message: error.details[0].message });
    return;
  }
  next();
};

export const changeEmailVerify = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
    otp: Joi.string().length(6).required().messages({
      "string.empty": "Please enter the OTP code!",
      "string.length": "OTP code must be 6 digits!",
      "any.required": "Please enter the OTP code!",
    }),
  });
  const { error } = schema.validate(req.body);
  if (error) {
    res.json({ code: "error", message: error.details[0].message });
    return;
  }
  next();
};

export const addressCreatePost = (req: Request, res: Response, next: NextFunction) => {
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
      .required()
      .custom((value, helpers) => {
        if(!/^(0?)(3[2-9]|5[6|8|9]|7[0|6-9]|8[0-6|8|9]|9[0-4|6-9])[0-9]{7}$/.test(value)) {
          return helpers.error('phone.valid');
        }
        return value;
      })
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
    isDefault: Joi.boolean()
      .required()
      .messages({
		    "boolean.base": "The field 'isDefault' must be true or false!",
		    "any.required": "Please provide the default address field!"
		  })
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

export const orderReviewPost = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
    orderId: Joi.string().required().messages({
      "string.empty": "Invalid order!",
      "any.required": "Invalid order!"
    }),
    orderItemId: Joi.string().required().messages({
      "string.empty": "Invalid order item!",
      "any.required": "Invalid order item!"
    }),
    rating: Joi.number().integer().min(1).max(5).required().messages({
      "number.base": "Please select a rating!",
      "number.min": "Please select at least 1 star!",
      "number.max": "Rating cannot exceed 5 stars!",
      "any.required": "Please select a rating!"
    }),
    comment: Joi.string().required().max(300).messages({
      "string.empty": "Please enter a review comment!",
      "string.max": "Comment cannot exceed 300 characters!",
      "any.required": "Please enter a review comment!"
    })
  });

  const { error } = schema.validate(req.body);
  if (error) {
    res.json({ code: "error", message: error.details[0].message });
    return;
  }
  next();
};
