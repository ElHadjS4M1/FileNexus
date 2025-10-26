import { prisma } from '../src/services/prisma';
import '../src/config/env';
import { hashPassword } from '../src/utils/password';

/**
 * Seeds the database with a default admin user if none exists.
 * @returns {Promise<void>} Resolves once seed completes.
 */
const seed = async (): Promise<void> => {
  const admin = await prisma.user.findFirst({ where: { role: 'admin' } });
  if (admin) {
    return;
  }

  const pwdHash = await hashPassword('ChangeMe123!');

  await prisma.user.create({
    data: {
      id: 'admin-id',
      username: 'admin',
      role: 'admin',
      pwdHash,
      publicKeyJwk: {},
      privEnc: Buffer.alloc(0),
      privNonce: Buffer.alloc(0),
      clientSalt: Buffer.alloc(0),
      kdfClient: { alg: 'PBKDF2-SHA256', iters: 310000 },
    },
  });
};

seed()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
