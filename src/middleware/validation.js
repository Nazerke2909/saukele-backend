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

export default validate;