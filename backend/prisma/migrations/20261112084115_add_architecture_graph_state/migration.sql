-- AlterTable
ALTER TABLE "architectures" ADD COLUMN     "edges" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "nodes" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "viewport" JSONB;
