import Joi from 'joi';

export const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(64).required(),
  fullName: Joi.string().min(1).max(100).optional(),
  role: Joi.string().valid('COUPLE', 'GUEST', 'FAMILY_MEMBER', 'MODERATOR', 'SUPER_ADMIN').optional(),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

export const refreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

export const emailSchema = Joi.object({
  email: Joi.string().email().required(),
});

export const verifyEmailSchema = Joi.object({
  email: Joi.string().email().required(),
  code: Joi.string().length(6).required(),
});

export const resetPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
  token: Joi.string().hex().length(64).required(),
  newPassword: Joi.string().min(8).max(64).required(),
});

const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.details.map((d) => d.message),
    });
  }
  next();
};
export const createPoolSchema = Joi.object({
  weddingId: Joi.number().integer().positive().required(),
  name: Joi.string().trim().min(1).max(255).required(),
  description: Joi.string().trim().allow('', null).max(1000),
  targetKzt: Joi.number().integer().positive().required(),
  privacy: Joi.string().valid('PUBLIC', 'FAMILY_ONLY', 'PRIVATE').default('PUBLIC'),
  isFragile: Joi.boolean().default(false),
}).messages({
  'any.required': '{{#label}} is required',
  'number.positive': '{{#label}} must be a positive number',
});

export const updatePoolSchema = Joi.object({
  name: Joi.string().trim().min(1).max(255),
  description: Joi.string().trim().allow('', null).max(1000),
  targetKzt: Joi.number().integer().positive(),
  privacy: Joi.string().valid('PUBLIC', 'FAMILY_ONLY', 'PRIVATE'),
  isFragile: Joi.boolean(),
}).min(1).messages({
  'object.min': 'At least one field must be provided for update',
});

export const createContributionSchema = Joi.object({
  poolId: Joi.number().integer().positive().required(),
  originalAmount: Joi.number().positive().required(),
  originalCurrency: Joi.string().trim().uppercase().length(3).required(),
  idempotencyKey: Joi.string().trim().min(1).required(),
}).messages({
  'any.required': '{{#label}} is required',
  'string.length': '{{#label}} must be a 3-letter currency code',
});

export const addFamilyMemberSchema = Joi.object({
  memberId: Joi.number().integer().positive().required(),
  ancestorId: Joi.number().integer().positive().allow(null),
  kinshipRank: Joi.string().valid('ATA_ANA', 'ZHIEN_ZHARAP', 'SHAKYRT').allow(null),
  giftObligation: Joi.number().integer().positive().allow(null),
}).messages({
  'any.required': '{{#label}} is required',
});

export default validate;