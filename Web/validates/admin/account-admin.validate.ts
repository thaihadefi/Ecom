import { Request, Response, NextFunction } from "express";
import Joi from "joi";

export const createPost = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
    fullName: Joi.string()
      .required()
      .min(5)
      .max(50)
      .messages({
        "string.empty": "Please enter your full name!",
        "string.min": "Full name must be at least 5 characters long!",
        "string.max": "Full name cannot exceed 50 characters!",
      }),
    email: Joi.string()
      .required()
      .email()
      .messages({
        "string.empty": "Please enter your email!",
        "string.email": "Invalid email format!"
      }),
    password: Joi.string()
      .required()
      .min(8)
      .custom((value, helpers) => {
        if(!/[A-Z]/.test(value)) {
          return helpers.error('password.uppercase');
        }
        if(!/[a-z]/.test(value)) {
          return helpers.error('password.lowercase');
        }
        if(!/\d/.test(value)) {
          return helpers.error('password.number');
        }
        if(!/[@$!%*?&]/.test(value)) {
          return helpers.error('password.special');
        }
        return value;
      })
      .messages({
        "string.empty": "Please enter your password!",
        "string.min": "Password must be at least 8 characters long!",
        "password.uppercase": "Password must contain at least one uppercase letter!",
        "password.lowercase": "Password must contain at least one lowercase letter!",
        "password.number": "Password must contain at least one number!",
        "password.special": "Password must contain at least one special character!",
      }),
    status: Joi.string().allow(''),
    avatar: Joi.string().allow(''),
    roles: Joi.string().allow(''),
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

export const editPatch = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
    fullName: Joi.string()
      .required()
      .min(5)
      .max(50)
      .messages({
        "string.empty": "Please enter your full name!",
        "string.min": "Full name must be at least 5 characters long!",
        "string.max": "Full name cannot exceed 50 characters!",
      }),
    email: Joi.string()
      .required()
      .email()
      .messages({
        "string.empty": "Please enter your email!",
        "string.email": "Invalid email format!"
      }),
    status: Joi.string().allow(''),
    avatar: Joi.string().allow(''),
    roles: Joi.string().allow(''),
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

export const changePasswordPatch = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
    password: Joi.string()
      .required()
      .min(8)
      .custom((value, helpers) => {
        if(!/[A-Z]/.test(value)) {
          return helpers.error('password.uppercase');
        }
        if(!/[a-z]/.test(value)) {
          return helpers.error('password.lowercase');
        }
        if(!/\d/.test(value)) {
          return helpers.error('password.number');
        }
        if(!/[@$!%*?&]/.test(value)) {
          return helpers.error('password.special');
        }
        return value;
      })
      .messages({
        "string.empty": "Please enter your password!",
        "string.min": "Password must be at least 8 characters long!",
        "password.uppercase": "Password must contain at least one uppercase letter!",
        "password.lowercase": "Password must contain at least one lowercase letter!",
        "password.number": "Password must contain at least one number!",
        "password.special": "Password must contain at least one special character!",
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