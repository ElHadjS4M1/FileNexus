"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = require("../src/services/prisma");
require("../src/config/env");
const password_1 = require("../src/utils/password");
/**
 * Inicializa la base de datos con un usuario administrador por defecto si no existe.
 * @returns {Promise<void>} Se resuelve cuando finaliza la siembra.
 */
const seed = async () => {
    const seedUsers = [
        {
            id: 'admin-id',
            username: 'admin',
            role: 'admin',
            password: 'ChangeMe123!',
        },
        {
            username: 'dept-head',
            role: 'dept_head',
            password: 'DeptHead123!',
        },
        {
            username: 'project-head',
            role: 'project_head',
            password: 'ProjectHead123!',
        },
        {
            username: 'user-standard',
            role: 'user',
            password: 'UserStandard123!',
        },
    ];
    for (const entry of seedUsers) {
        const existing = await prisma_1.prisma.user.findUnique({
            where: { username: entry.username },
        });
        if (existing) {
            continue;
        }
        const pwdHash = await (0, password_1.hashPassword)(entry.password);
        await prisma_1.prisma.user.create({
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
    await prisma_1.prisma.$disconnect();
})
    .catch(async (error) => {
    console.error(error);
    await prisma_1.prisma.$disconnect();
    process.exit(1);
});
