import Joi from "joi";

export const slugField = () =>
  Joi.string()
    .trim()
    .max(200)
    .pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .required()
    .messages({
      "string.empty": "Please enter slug!",
      "any.required": "Please enter slug!",
      "string.pattern.base": "Slug may only contain lowercase letters, numbers and single hyphens!",
    });
