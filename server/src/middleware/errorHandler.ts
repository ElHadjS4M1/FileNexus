import type { NextFunction, Request, Response } from 'express';
import { logger } from '../logger';
import { HttpError } from '../utils/httpError';

/**
 * Centralized error handler that translates thrown errors into sanitized responses.
 * @param {Error} err - Captured error.
 * @param {Request} _req - Express request.
 * @param {Response} res - Express response.
 * @param {NextFunction} next - Express next handler.
 * @returns {void}
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (err: Error, _req: Request, res: Response, next: NextFunction): void => {
  if (res.headersSent) {
    next(err);
    return;
  }

  const status = err instanceof HttpError ? err.statusCode : 500;
  const message = err instanceof HttpError ? err.message : 'Unexpected server error';

  logger.error(
    {
      err,
      status,
      details: err instanceof HttpError ? err.details : undefined,
    },
    'Request failed',
  );

  res.status(status).json({ error: message });
};
