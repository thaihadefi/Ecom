import { Request, Response, NextFunction } from "express";
import Joi from "joi";

export const changeFileNamePatch = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
    folder: Joi.string().required().messages({
      "string.empty": "Missing folder!",
      "any.required": "Missing folder!"
    }),
    oldFileName: Joi.string().required().messages({
      "string.empty": "Missing old file name!",
      "any.required": "Missing old file name!"
    }),
    newFileName: Joi.string()
      .required()
      .max(255)
      .pattern(/^[^/\\:*?"<>|]+$/)
      .messages({
        "string.empty": "Please enter a file name!",
        "string.max": "File name cannot exceed 255 characters!",
        "string.pattern.base": "File name contains invalid characters!"
      })
  });

  const { error } = schema.validate(req.body);
  if (error) {
    res.json({ code: "error", message: error.details[0].message });
    return;
  }
  next();
};
