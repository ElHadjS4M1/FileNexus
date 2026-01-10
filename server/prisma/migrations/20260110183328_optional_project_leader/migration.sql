-- DropForeignKey
ALTER TABLE "Project" DROP CONSTRAINT "Project_leaderId_fkey";

-- AlterTable
ALTER TABLE "Project" ALTER COLUMN "leaderId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
