import { prisma } from '../src/services/prisma';
import '../src/config/env';
import { hashPassword } from '../src/utils/password';

/**
 * Inicializa la base de datos con un usuario administrador por defecto si no existe.
 * @returns {Promise<void>} Se resuelve cuando finaliza la siembra.
 */
const seed = async (): Promise<void> => {
  const seedUsers = [
    {
      id: 'admin-id',
      username: 'admin',
      role: 'admin' as const,
      password: 'ChangeMe123!',
    },
    {
      username: 'dept-head',
      role: 'dept_head' as const,
      password: 'DeptHead123!',
    },
    {
      username: 'project-head',
      role: 'project_head' as const,
      password: 'ProjectHead123!',
    },
    {
      username: 'user-standard',
      role: 'user' as const,
      password: 'UserStandard123!',
    },
  ];

  for (const entry of seedUsers) {
    const existing = await prisma.user.findUnique({
      where: { username: entry.username },
    });
    if (existing) {
      continue;
    }

    const pwdHash = await hashPassword(entry.password);
    await prisma.user.create({
      data: {
        ...(entry.id ? { id: entry.id } : {}),
        username: entry.username,
        role: entry.role,
        pwdHash,
        publicKeyJwk: {},
        privEnc: Buffer.alloc(0),
        privNonce: Buffer.alloc(0),
        clientSalt: Buffer.alloc(0),
        kdfClient: { alg: 'PBKDF2-SHA256', iters: 310000 },
      },
    });
  }
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
