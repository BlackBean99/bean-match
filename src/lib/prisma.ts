import { PrismaClient, type Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
export { hasDatabaseUrl } from "@/lib/runtime-env";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  const log: Prisma.LogLevel[] = process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"];

  if (!connectionString) {
    return createPrismaStub();
  }

  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter, log });
}

function createPrismaStub() {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "$disconnect") {
          return async () => undefined;
        }

        if (prop === "$connect") {
          return async () => {
            throw new Error("DATABASE_URL is required to use Prisma on this runtime.");
          };
        }

        return async () => {
          throw new Error("DATABASE_URL is required to use Prisma on this runtime.");
        };
      },
    },
  ) as unknown as PrismaClient;
}

export const prisma =
  globalForPrisma.prisma ??
  createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
