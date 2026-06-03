import { PrismaClient } from "@prisma/client";
import { canUsePrismaRuntime } from "@/lib/runtime-env";
export { hasDatabaseUrl } from "@/lib/runtime-env";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

function createPrismaClient() {
  if (!canUsePrismaRuntime()) {
    return createPrismaStub();
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function createPrismaStub() {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "$disconnect" || prop === "$connect") {
          return async () => undefined;
        }

        return async () => {
          throw new Error("Prisma is disabled in the Cloudflare runtime. Use the Supabase fallback path instead.");
        };
      },
    },
  ) as unknown as PrismaClient;
}
