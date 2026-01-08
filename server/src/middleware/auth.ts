import type { NextFunction, Request, Response } from 'express';
import { verifyJwt } from '../utils/jwt';
import { HttpError } from '../utils/httpError';

const AUTH_COOKIE = 'token';

/**
 * Middleware que autentica las solicitudes usando la cookie JWT con la bandera HttpOnly.
 * @param {Request} req - Solicitud de Express.
 * @param {Response} _res - Respuesta de Express.
 * @param {NextFunction} next - Siguiente función middleware.
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
 * Fábrica que aplica control de acceso basado en roles para endpoints específicos.
 * @param {string[]} allowedRoles - Roles permitidos para alcanzar el manejador.
 * @returns {(req: Request, res: Response, next: NextFunction) => void} Middleware de Express.
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
