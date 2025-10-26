/*
  Warnings:

  - You are about to drop the column `ciphertext` on the `File` table. All the data in the column will be lost.
  - Added the required column `filePath` to the `File` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "File" DROP COLUMN "ciphertext",
ADD COLUMN     "filePath" TEXT NOT NULL;
