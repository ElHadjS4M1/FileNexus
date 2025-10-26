import type { NextFunction, Request, Response } from 'express';
import { verifyJwt } from '../utils/jwt';
import { HttpError } from '../utils/httpError';

const AUTH_COOKIE = 'token';

/**
 * Middleware that authenticates requests using the HttpOnly JWT cookie.
 * @param {Request} req - Express request.
 * @param {Response} _res - Express response.
 * @param {NextFunction} next - Next middleware function.
 * @returns {void}
 */
export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  const token = req.cookies?.[AUTH_COOKIE];
  if (!token) {
    throw new HttpError(401, 'Authentication required');
  }

  try {
    const claims = verifyJwt(token);
    req.authUser = { id: claims.sub, role: claims.role };
    next();
  } catch (error) {
    throw new HttpError(401, 'Invalid or expired token', { cause: error });
  }
};

/**
 * Factory that enforces role-based access control for specific endpoints.
 * @param {string[]} allowedRoles - Roles permitted to reach the handler.
 * @returns {(req: Request, res: Response, next: NextFunction) => void} Express middleware.
 */
export const requireRole =
  (allowedRoles: string[]) => (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.authUser) {
      throw new HttpError(401, 'Authentication required');
    }

    if (!allowedRoles.includes(req.authUser.role)) {
      throw new HttpError(403, 'Insufficient permissions');
    }

    next();
  };
