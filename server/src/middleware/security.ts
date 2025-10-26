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
 * Builds the CORS middleware enforcing a small allowlist.
 * @returns {RequestHandler} Configured CORS middleware instance.
 */
export const buildCors = (): RequestHandler =>
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, origin ?? allowedOrigins[0]);
        return;
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  });

/**
 * Creates the application-wide rate limiter.
 * @returns {RequestHandler} Rate-limit middleware.
 */
export const buildRateLimiter = (): RequestHandler =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: DEFAULT_LIMIT,
    standardHeaders: true,
    legacyHeaders: false,
  }) as unknown as RequestHandler;

/**
 * Provides the security headers configuration via helmet.
 * @returns {RequestHandler} Helmet middleware.
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
