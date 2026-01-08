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
 * Genera un JWT firmado para la identidad de usuario proporcionada.
 * @param {{ id: string; role: string }} user - Descriptor básico del usuario.
 * @returns {string} Cadena JWT compacta firmada con RS256.
 */
export const createJwt = (user: { id: string; role: string }): string =>
  jwt.sign({ sub: user.id, role: user.role }, pemPrivate, {
    algorithm: 'RS256',
    expiresIn: TOKEN_TTL,
  });

/**
 * Genera un token de corta duración que autoriza la inicialización del primer inicio de sesión.
 * @param {string} userId - Identificador del usuario.
 * @returns {string} Token de inicialización firmado con RS256.
 */
export const createInitToken = (userId: string): string =>
  jwt.sign({ sub: userId, scope: 'init' }, pemPrivate, {
    algorithm: 'RS256',
    expiresIn: INIT_TOKEN_TTL,
  });

/**
 * Verifica y descodifica un JWT emitido por la plataforma.
 * @param {string} token - Cadena JWT serializada.
 * @returns {JwtClaims} Reclamaciones descodificadas cuando el token es válido.
 * @throws {Error} Si el token es inválido o ha expirado.
 */
export const verifyJwt = (token: string): JwtClaims =>
  jwt.verify(token, pemPublic, { algorithms: ['RS256'] }) as JwtClaims;

/**
 * Valida un token de inicialización emitido para cuentas pendientes.
 * @param {string} token - Token de inicialización serializado.
 * @returns {InitClaims} Reclamaciones de inicialización descodificadas.
 */
export const verifyInitToken = (token: string): InitClaims =>
  jwt.verify(token, pemPublic, { algorithms: ['RS256'] }) as InitClaims;
