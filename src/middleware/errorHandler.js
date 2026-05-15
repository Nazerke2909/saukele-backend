import { env } from '../config/env.js';

export class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const notFound = (req, res, next) => {
  res.status(404).json({
    error: `Route ${req.originalUrl} not found`,
    statusCode: 404,
  });
};

export const errorHandler = (err, req, res, next) => {
  if (err instanceof AppError) {
    const body = {
      error: err.message,
      statusCode: err.statusCode,
    };
    if (err.details) {
      body.details = err.details;
    }
    return res.status(err.statusCode).json(body);
  }

  if (err.isJoi || (err.name === 'ValidationError' && err.details)) {
    return res.status(422).json({
      error: 'Validation failed',
      statusCode: 422,
      details: err.details.map((d) => d.message),
    });
  }

  if (err.code && err.code.startsWith('P')) {
    switch (err.code) {
      case 'P2002':
        return res.status(409).json({
          error: 'Resource already exists',
          statusCode: 409,
          details: [`Unique constraint violation on ${err.meta?.target || 'unknown field'}`],
        });
      case 'P2025':
        return res.status(404).json({
          error: 'Resource not found',
          statusCode: 404,
        });
      default:
        return res.status(500).json({
          error: 'Database error',
          statusCode: 500,
        });
    }
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'Invalid JSON in request body',
      statusCode: 400,
    });
  }

  const statusCode = err.statusCode || 500;
  const message = statusCode === 500 ? err.message || 'Internal server error' : err.message;

  console.error(`[ERROR] ${statusCode} - ${err.message}`);
  console.error(err.stack);

  res.status(statusCode).json({
    error: message,
    statusCode,
    ...(env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
};