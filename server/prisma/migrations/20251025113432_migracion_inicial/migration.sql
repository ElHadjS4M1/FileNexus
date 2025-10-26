-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'dept_head', 'project_head', 'user');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('pending_init', 'active');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "pwdHash" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'pending_init',
    "publicKeyJwk" JSONB NOT NULL,
    "privEnc" BYTEA NOT NULL,
    "privNonce" BYTEA NOT NULL,
    "clientSalt" BYTEA NOT NULL,
    "kdfClient" JSONB NOT NULL,
    "totpSecretEnc" BYTEA,
    "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "File" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "meta" JSONB,
    "aeadNonce" BYTEA NOT NULL,
    "ciphertext" BYTEA NOT NULL,
    "ekOwner" BYTEA NOT NULL,
    "hashC" BYTEA,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "File_ownerId_idx" ON "File"("ownerId");

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
