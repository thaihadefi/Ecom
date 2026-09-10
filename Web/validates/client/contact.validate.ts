import { Request, Response, NextFunction } from "express";
import Joi from "joi";

export const contactPost = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
    name: Joi.string()
      .min(5)
      .max(50)
      .required()
      .messages({
        "string.empty": "Please enter your name!",
        "string.min": "Name must be at least 5 characters long!",
        "string.max": "Name cannot exceed 50 characters!",
      }),
    email: Joi.string()
      .email()
      .required()
      .messages({
        "string.empty": "Please enter your email!",
        "string.email": "Invalid email address format!",
      }),
    subject: Joi.string()
      .min(5)
      .max(100)
      .allow("")
      .optional()
      .messages({
        "string.min": "Subject must be at least 5 characters long!",
        "string.max": "Subject cannot exceed 100 characters!",
      }),
    message: Joi.string()
      .min(10)
      .max(500)
      .required()
      .messages({
        "string.empty": "Please enter your message!",
        "string.min": "Message must be at least 10 characters long!",
        "string.max": "Message cannot exceed 500 characters!",
      }),
  });

  const { error } = schema.validate(req.body);

  if (error) {
    const errorMessage = error.details[0].message;
    res.json({
      code: "error",
      message: errorMessage
    });
    return;
  }

  next();
};
