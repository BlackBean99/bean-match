import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { canUsePrismaRuntime, getRuntimeEnv } from "@/lib/runtime-env";
export { hasDatabaseUrl } from "@/lib/runtime-env";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrismaClient();
    const value = Reflect.get(client as object, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
}) as PrismaClient;

function getPrismaClient() {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  const client = createPrismaClient();
  globalForPrisma.prisma = client;
  return client;
}

function createPrismaClient(): PrismaClient {
  if (!canUsePrismaRuntime()) {
    return createPrismaStub();
  }

  const databaseUrl = getRuntimeEnv().DATABASE_URL;
  if (!databaseUrl) {
    return createPrismaStub();
  }

  const adapter = new PrismaPg({ connectionString: databaseUrl });

  return new PrismaClient({
    adapter,
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
