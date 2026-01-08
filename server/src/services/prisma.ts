import { PrismaClient } from '@prisma/client';
import { logger } from '../logger';

export const prisma = new PrismaClient();

/**
 * Conecta el ciclo de vida de Prisma para garantizar un apagado ordenado y registrar información útil.
 * @returns {void}
 */
export const registerPrismaShutdown = (): void => {
  process.on('SIGINT', async () => {
    await prisma.$disconnect();
    logger.info('Prisma disconnected due to SIGINT');
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await prisma.$disconnect();
    logger.info('Prisma disconnected due to SIGTERM');
    process.exit(0);
  });
};
