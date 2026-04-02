// utils/errors.js
import { logger } from '@/utils/logger';

/**
 * Base class for application errors
 */
export class AppError extends Error {
  constructor(message, code = 500, data = null) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.data = data;
    this.timestamp = new Date();
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      data: this.data,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

/**
 * API related errors
 */
export class APIError extends AppError {
  constructor(message, code = 500, data = null) {
    super(message, code, data);
    this.type = 'APIError';
  }
}

/**
 * Validation errors
 */
export class ValidationError extends AppError {
  constructor(message, errors = [], data = null) {
    super(message, 400, { errors, ...data });
    this.type = 'ValidationError';
  }
}

/**
 * Authentication errors
 */
export class AuthError extends AppError {
  constructor(message = 'Authentication failed', data = null) {
    super(message, 401, data);
    this.type = 'AuthError';
  }
}

/**
 * Authorization errors
 */
export class ForbiddenError extends AppError {
  constructor(message = 'Access denied', data = null) {
    super(message, 403, data);
    this.type = 'ForbiddenError';
  }
}

/**
 * Not found errors
 */
export class NotFoundError extends AppError {
  constructor(resource = 'Resource', data = null) {
    super(`${resource} not found`, 404, data);
    this.type = 'NotFoundError';
  }
}

/**
 * Database errors
 */
export class DatabaseError extends AppError {
  constructor(message, operation = null, data = null) {
    super(message, 500, { operation, ...data });
    this.type = 'DatabaseError';
  }
}

/**
 * Socket related errors
 */
export class SocketError extends AppError {
  constructor(message, code = 500, data = null) {
    super(message, code, data);
    this.type = 'SocketError';
  }
}

/**
 * Rate limit errors
 */
export class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded', data = null) {
    super(message, 429, data);
    this.type = 'RateLimitError';
  }
}

/**
 * Service unavailable errors
 */
export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporarily unavailable', data = null) {
    super(message, 503, data);
    this.type = 'ServiceUnavailableError';
  }
}

/**
 * Error handling utilities
 */
export const ErrorHandler = {
  /**
   * Handle API errors
   */
  handleError(err, req, res, _next) {
    const error = err instanceof AppError ? err : new AppError(err.message);

    logger.error(`${error.type || 'Error'}: ${error.message}`, {
      error: error.toJSON(),
      request: {
        method: req.method,
        url: req.originalUrl,
        params: req.params,
        query: req.query,
        body: req.body,
        user: req.user ? { id: req.user.id } : null,
      },
    });

    if (!res.headersSent) {
      res.status(error.code).json({
        error: {
          type: error.type || 'GeneralError',
          message: error.message,
          code: error.code,
          ...(process.env.NODE_ENV === 'development' ? { stack: error.stack } : {}),
        },
      });
    }
  },

  /**
   * Handle socket errors
   */
  handleSocketError(error, socket) {
    const err = error instanceof AppError ? error : new SocketError(error.message);

    logger.error(`Socket Error: ${err.message}`, {
      error: err.toJSON(),
      socket: {
        id: socket.id,
        user: socket.user ? { id: socket.user.id } : null,
      },
    });

    socket.emit('error', {
      type: err.type || 'SocketError',
      message: err.message,
      code: err.code,
    });
  },

  /**
   * Assert a condition or throw an error
   */
  assert(condition, message, ErrorType = AppError, code = 500, data = null) {
    if (!condition) {
      throw new ErrorType(message, code, data);
    }
  },

  /**
   * Wrap async route handlers for Express
   */
  asyncHandler(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  },

  /**
   * Ensure required fields exist
   */
  validateRequired(obj, fields, message = 'Missing required fields') {
    const missing = fields.filter((field) => !obj[field]);
    if (missing.length > 0) {
      throw new ValidationError(message, missing);
    }
  },

  /**
   * Check authorization
   */
  checkAuthorization(condition, message = 'Access denied') {
    if (!condition) {
      throw new ForbiddenError(message);
    }
  },
};
