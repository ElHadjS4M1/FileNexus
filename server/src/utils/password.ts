import argon2 from 'argon2';

const ARGON2_OPTIONS: argon2.Options & { type: argon2.ArgonType } = {
  type: argon2.argon2id,
  timeCost: 3,
  memoryCost: 19456,
  parallelism: 1,
  hashLength: 32,
  saltLength: 16,
};

/**
 * Derives an Argon2id hash that protects the provided password value.
 * @param {string} password - Raw password string.
 * @returns {Promise<string>} Encoded Argon2 hash string.
 */
export const hashPassword = async (password: string): Promise<string> =>
  argon2.hash(password, ARGON2_OPTIONS);

/**
 * Validates a password against a stored Argon2 hash.
 * @param {string} password - Password supplied by the user.
 * @param {string} hash - Stored Argon2 hash.
 * @returns {Promise<boolean>} Whether the password matches.
 */
export const verifyPassword = async (password: string, hash: string): Promise<boolean> =>
  argon2.verify(hash, password, ARGON2_OPTIONS);
