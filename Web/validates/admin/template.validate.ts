import { Request, Response, NextFunction } from "express";
import Joi from "joi";
import { sendCaughtError } from "../../helpers/http-response.helper";

const schema = Joi.object({
  name: Joi.string().trim().max(200).required().messages({
    "string.empty": "Please enter template name!",
    "any.required": "Please enter template name!",
  }),
  slug: Joi.string().trim().max(200).required().messages({
    "string.empty": "Please enter template slug!",
    "any.required": "Please enter template slug!",
  }),
  status: Joi.string().valid("active", "inactive", ""),
  blocks: Joi.array()
    .items(
      Joi.object({
        blockId: Joi.string().hex().length(24).required(),
        position: Joi.number().integer().min(0).required(),
      })
    )
    .default([]),
});

export const templatePost = (req: Request, res: Response, next: NextFunction) => {
  const body = { ...req.body };
  if (typeof body.blocks === "string") {
    try {
      body.blocks = JSON.parse(body.blocks);
    } catch (error) {
      sendCaughtError(res, error, "Invalid block list!", "Invalid block list!");
      return;
    }
  }

  const { error, value } = schema.validate(body, { stripUnknown: true });

  if (error) {
    res.status(400).json({ code: "error", message: error.details[0].message });
    return;
  }

  req.body = value;
  next();
};
