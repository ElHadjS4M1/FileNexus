import argon2 from 'argon2';

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  timeCost: 3,
  memoryCost: 19456,
  parallelism: 1,
  hashLength: 32,
  saltLength: 16,
};

/**
 * Deriva un hash Argon2id que protege el valor de la contraseña proporcionada.
 * @param {string} password - Cadena de contraseña en texto claro.
 * @returns {Promise<string>} Cadena de hash Argon2 codificada.
 */
export const hashPassword = async (password) =>
  argon2.hash(password, ARGON2_OPTIONS);