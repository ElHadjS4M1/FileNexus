import type { User, UserRole } from '@prisma/client';
import { prisma } from './prisma';
import { hashPassword } from '../utils/password';
import type { JsonObject } from '@prisma/client/runtime/library';

const EMPTY_BUFFER = Buffer.alloc(0);

export type InitPayload = {
  passwordNew: string;
  publicKeyJwk: JsonObject;
  publicKeyPem?: string;
  privEnc: Buffer;
  privNonce: Buffer;
  clientSalt: Buffer;
  kdfClient: JsonObject;
};

/**
 * Crea un usuario pendiente con una contraseña temporal proporcionada por un administrador.
 * @param {{ username: string; role: UserRole; password: string }} data - Definición de la cuenta.
 * @returns {Promise<User>} Entidad de usuario recién creada.
 */
export const createPendingUser = async (data: {
  username: string;
  role: UserRole;
  password: string;
}): Promise<User> => {
  const pwdHash = await hashPassword(data.password);
  return prisma.user.create({
    data: {
      username: data.username,
      role: data.role,
      pwdHash,
      publicKeyJwk: {},
      privEnc: EMPTY_BUFFER,
      privNonce: EMPTY_BUFFER,
      clientSalt: EMPTY_BUFFER,
      kdfClient: { alg: 'PBKDF2-SHA256', iters: 310000 },
    },
  });
};

/**
 * Devuelve una lista de usuarios sin materiales sensibles.
 * @returns {Promise<Array<Pick<User, 'id' | 'username' | 'role' | 'status' | 'createdAt'>>>} Usuarios saneados.
 */
export const listUsers = (): Promise<
  Array<Pick<User, 'id' | 'username' | 'role' | 'status' | 'createdAt'>>
> =>
  prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      username: true,
      role: true,
      status: true,
      createdAt: true,
    },
  });

/**
 * Obtiene un usuario por nombre, incluyendo campos sensibles para los flujos de autenticación.
 * @param {string} username - Identificador de inicio de sesión.
 * @returns {Promise<User | null>} Usuario coincidente o null.
 */
export const findUserByUsername = (username: string): Promise<User | null> =>
  prisma.user.findUnique({ where: { username } });

/**
 * Obtiene un usuario por su identificador.
 * @param {string} id - Identificador del usuario.
 * @returns {Promise<User | null>} Usuario coincidente o null.
 */
export const findUserById = (id: string): Promise<User | null> =>
  prisma.user.findUnique({ where: { id } });

/**
 * Aplica los materiales de inicialización del primer acceso y actualiza el estado del usuario a activo.
 * @param {string} userId - Identificador del usuario.
 * @param {InitPayload} payload - Nueva contraseña y artefactos criptográficos.
 * @returns {Promise<User>} Entidad de usuario actualizada.
 */
export const completeInitialization = async (
  userId: string,
  payload: InitPayload,
): Promise<User> => {
  const pwdHash = await hashPassword(payload.passwordNew);
  const publicKeyData =
    typeof payload.publicKeyJwk === 'object' && payload.publicKeyJwk !== null
      ? {
        ...payload.publicKeyJwk,
        ...(payload.publicKeyPem ? { pem: payload.publicKeyPem } : {}),
      }
      : payload.publicKeyJwk;
  return prisma.user.update({
    where: { id: userId },
    data: {
      pwdHash,
      status: 'active',
      publicKeyJwk: publicKeyData,
      privEnc: payload.privEnc,
      privNonce: payload.privNonce,
      clientSalt: payload.clientSalt,
      kdfClient: payload.kdfClient,
    },
  });
};

/**
 * Persiste el secreto TOTP cifrado de un usuario.
 * @param {string} userId - Identificador del usuario.
 * @param {Buffer} secretWrapped - Secreto TOTP cifrado.
 * @param {boolean} enabled - Indica si el 2FA ya está activado.
 * @returns {Promise<User>} Entidad de usuario actualizada.
 */
export const setTotpSecret = (
  userId: string,
  secretWrapped: Buffer,
  enabled: boolean,
): Promise<User> =>
  prisma.user.update({
    where: { id: userId },
    data: { totpSecretEnc: secretWrapped, totpEnabled: enabled },
  });

/**
 * Marca el 2FA como habilitado cuando el usuario valida su token.
 * @param {string} userId - Identificador del usuario.
 * @returns {Promise<User>} Entidad de usuario actualizada.
 */
export const enableTotp = (userId: string): Promise<User> =>
  prisma.user.update({
    where: { id: userId },
    data: { totpEnabled: true },
  });
