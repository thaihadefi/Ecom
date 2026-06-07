import { Request, Response, NextFunction } from "express";
import Joi from "joi";

export const loginPost = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
    email: Joi.string()
      .required()
      .email()
      .messages({
        "string.empty": "Please enter your email!",
        "string.email": "Invalid email format!"
      }),
    password: Joi.string()
      .required()
      .messages({
        "string.empty": "Please enter your password!"
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