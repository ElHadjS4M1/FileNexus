import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import type { RequestHandler } from 'express';
import { appEnv } from '../config/env';

const DEFAULT_LIMIT = 100;

const defaultOrigins = [
  'https://localhost:5173',
  'http://localhost:5173',
  'https://localhost:3000',
  'http://localhost:3000',
];

const allowedOrigins = appEnv.CORS_ALLOWED_ORIGINS
  ? appEnv.CORS_ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
  : defaultOrigins;

/**
 * Construye el middleware CORS aplicando una lista de permitidos reducida.
 * @returns {RequestHandler} Instancia del middleware CORS configurado.
 */
export const buildCors = (): RequestHandler =>
  cors({
    origin: (origin: string | undefined, callback: (err: Error | null, origin?: string) => void) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, origin ?? allowedOrigins[0]);
        return;
      }
      console.warn(`Blocked by CORS: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  });

/**
 * Crea el limitador de peticiones global de la aplicación.
 * @returns {RequestHandler} Middleware de rate limiting.
 */
export const buildRateLimiter = (): RequestHandler =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: DEFAULT_LIMIT,
    standardHeaders: true,
    legacyHeaders: false,
  }) as unknown as RequestHandler;

/**
 * Proporciona la configuración de cabeceras de seguridad mediante helmet.
 * @returns {RequestHandler} Middleware de helmet.
 */
export const buildHelmet = (): RequestHandler =>
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false,
  });
