import { Request, Response, NextFunction } from "express";
import Joi from "joi";

export const registerPost = (req: Request, res: Response, next: NextFunction) => {
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
    email: Joi.string()
      .email()
      .required()
      .messages({
        "string.empty": "Please enter your email!",
        "string.email": "Invalid email format!",
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
    password: Joi.string()
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
        if(!/[~!@#$%^&*]/.test(value)) {
          return helpers.error('password.special');
        }
        return value;
      })
      .required()
      .messages({
        "string.empty": "Please enter your password!",
        "string.min": "Password must be at least 8 characters long!",
        "password.uppercase": "Password must contain at least one uppercase letter!",
        "password.lowercase": "Password must contain at least one lowercase letter!",
        "password.number": "Password must contain at least one number!",
        "password.special": "Password must contain at least one special character! (~!@#$%^&*)",
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

export const loginPost = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
    email: Joi.string()
      .email()
      .required()
      .messages({
        "string.empty": "Please enter your email!",
        "string.email": "Invalid email format!",
      }),
    password: Joi.string()
      .required()
      .messages({
        "string.empty": "Please enter your password!",
      }),
    rememberPassword: Joi.boolean()
      .truthy("true", "on", "1")
      .falsy("false", "0", "")
      .default(false)
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

export const forgotPasswordPost = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
    email: Joi.string()
      .email()
      .required()
      .messages({
        "string.empty": "Please enter your email!",
        "string.email": "Invalid email format!",
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

export const otpPasswordPost = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
    email: Joi.string()
      .email()
      .required()
      .messages({
        "string.empty": "Please provide your email!",
        "string.email": "Invalid email format!",
      }),
    otp: Joi.string()
      .required()
      .messages({
        "string.empty": "Please enter the OTP code!",
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

export const resetPasswordPost = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
    password: Joi.string()
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
        if(!/[~!@#$%^&*]/.test(value)) {
          return helpers.error('password.special');
        }
        return value;
      })
      .required()
      .messages({
        "string.empty": "Please enter your password!",
        "string.min": "Password must be at least 8 characters long!",
        "password.uppercase": "Password must contain at least one uppercase letter!",
        "password.lowercase": "Password must contain at least one lowercase letter!",
        "password.number": "Password must contain at least one number!",
        "password.special": "Password must contain at least one special character! (~!@#$%^&*)",
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