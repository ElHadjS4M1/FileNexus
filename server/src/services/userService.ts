import type { User, UserRole } from '@prisma/client';
import { prisma } from './prisma';
import { hashPassword } from '../utils/password';

const EMPTY_BUFFER = Buffer.alloc(0);

export type InitPayload = {
  passwordNew: string;
  publicKeyJwk: unknown;
  publicKeyPem?: string;
  privEnc: Buffer;
  privNonce: Buffer;
  clientSalt: Buffer;
  kdfClient: unknown;
};

/**
 * Creates a pending user with a temporary password provided by an administrator.
 * @param {{ username: string; role: UserRole; password: string }} data - Account definition.
 * @returns {Promise<User>} Newly created user entity.
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
 * Returns a list of users without sensitive materials.
 * @returns {Promise<Array<Pick<User, 'id' | 'username' | 'role' | 'status' | 'createdAt'>>>} Sanitized users.
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
 * Fetches a user by username including sensitive fields for authentication flows.
 * @param {string} username - Login identifier.
 * @returns {Promise<User | null>} Matching user or null.
 */
export const findUserByUsername = (username: string): Promise<User | null> =>
  prisma.user.findUnique({ where: { username } });

/**
 * Fetches a user by id.
 * @param {string} id - User identifier.
 * @returns {Promise<User | null>} Matching user or null.
 */
export const findUserById = (id: string): Promise<User | null> =>
  prisma.user.findUnique({ where: { id } });

/**
 * Applies first-login initialization materials and updates user status to active.
 * @param {string} userId - User identifier.
 * @param {InitPayload} payload - New password and cryptographic artifacts.
 * @returns {Promise<User>} Updated user entity.
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
 * Persists encrypted TOTP secret material for a user.
 * @param {string} userId - User identifier.
 * @param {Buffer} secretWrapped - Encrypted TOTP secret.
 * @param {boolean} enabled - Whether 2FA is already activated.
 * @returns {Promise<User>} Updated user entity.
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
 * Marks 2FA as enabled once the user validates their token.
 * @param {string} userId - User identifier.
 * @returns {Promise<User>} Updated user entity.
 */
export const enableTotp = (userId: string): Promise<User> =>
  prisma.user.update({
    where: { id: userId },
    data: { totpEnabled: true },
  });
