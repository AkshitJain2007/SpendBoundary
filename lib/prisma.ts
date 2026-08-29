import { PrismaClient } from "@prisma/client";

export type CustomPrismaClient = PrismaClient & {
  paymentMandate: any;
};

const globalForPrisma = global as unknown as { prisma: CustomPrismaClient };

export const prisma: CustomPrismaClient =
  globalForPrisma.prisma ||
  (new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  }) as unknown as CustomPrismaClient);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
