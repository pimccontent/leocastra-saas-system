/*
  Warnings:

  - Added the required column `maxStreams` to the `Plan` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "maxStreams" INTEGER NOT NULL;
