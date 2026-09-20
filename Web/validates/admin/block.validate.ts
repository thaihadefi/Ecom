import { Request, Response, NextFunction } from "express";
import Joi from "joi";
import { getBlockTemplateFiles } from "../../services/admin/block.service";

const schema = Joi.object({
  name: Joi.string().trim().max(200).required().messages({
    "string.empty": "Please enter block name!",
    "any.required": "Please enter block name!",
  }),
  fileName: Joi.string().required(),
  status: Joi.string().valid("active", "inactive", ""),
  data: Joi.object().unknown(true).default({}),
});

export const blockPost = (req: Request, res: Response, next: NextFunction) => {
  const { error, value } = schema.validate(req.body, { stripUnknown: true });

  if (error) {
    res.status(400).json({ code: "error", message: error.details[0].message });
    return;
  }

  if (!getBlockTemplateFiles().includes(value.fileName)) {
    res.status(400).json({ code: "error", message: "Invalid block template file!" });
    return;
  }

  req.body = value;
  next();
};
