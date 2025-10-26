import jwt from 'jsonwebtoken';
import { loadJwtKeys } from '../config/crypto';

const { pemPrivate, pemPublic } = loadJwtKeys();

export type JwtClaims = {
  sub: string;
  role: string;
};

export type InitClaims = {
  sub: string;
  scope: 'init';
};

const TOKEN_TTL = '1h';
const INIT_TOKEN_TTL = '15m';

/**
 * Generates a signed JWT for the provided user identity.
 * @param {{ id: string; role: string }} user - Basic user descriptor.
 * @returns {string} RS256 signed compact JWT string.
 */
export const createJwt = (user: { id: string; role: string }): string =>
  jwt.sign({ sub: user.id, role: user.role }, pemPrivate, {
    algorithm: 'RS256',
    expiresIn: TOKEN_TTL,
  });

/**
 * Generates a short-lived token that authorizes first-login initialization.
 * @param {string} userId - User identifier.
 * @returns {string} RS256 signed initialization token.
 */
export const createInitToken = (userId: string): string =>
  jwt.sign({ sub: userId, scope: 'init' }, pemPrivate, {
    algorithm: 'RS256',
    expiresIn: INIT_TOKEN_TTL,
  });

/**
 * Verifies and decodes a JWT issued by the platform.
 * @param {string} token - Serialized JWT string.
 * @returns {JwtClaims} Decoded claims when token is valid.
 * @throws {Error} If token invalid or expired.
 */
export const verifyJwt = (token: string): JwtClaims =>
  jwt.verify(token, pemPublic, { algorithms: ['RS256'] }) as JwtClaims;

/**
 * Validates an initialization token emitted for pending accounts.
 * @param {string} token - Serialized init token.
 * @returns {InitClaims} Decoded initialization claims.
 */
export const verifyInitToken = (token: string): InitClaims =>
  jwt.verify(token, pemPublic, { algorithms: ['RS256'] }) as InitClaims;
