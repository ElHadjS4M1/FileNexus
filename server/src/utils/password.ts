import argon2 from 'argon2';

const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  timeCost: 3,
  memoryCost: 19456,
  parallelism: 1,
  hashLength: 32,
};

/**
 * Valida una contraseña frente a un hash Argon2 almacenado.
 * @param {string} password - Contraseña aportada por el usuario.
 * @param {string} hash - Hash Argon2 almacenado.
 * @returns {Promise<boolean>} Indica si la contraseña coincide.
 */
export const verifyPassword = async (password: string, hash: string): Promise<boolean> =>
  argon2.verify(hash, password, ARGON2_OPTIONS);

/**
 * Genera un hash Argon2 seguro para la contraseña proporcionada.
 * @param {string} password - Contraseña en texto plano.
 * @returns {Promise<string>} Hash Argon2.
 */
export const hashPassword = async (password: string): Promise<string> =>
  argon2.hash(password, ARGON2_OPTIONS);
