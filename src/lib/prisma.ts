import { PrismaClient, Prisma } from "@prisma/client";

// --- Transient-failure retry for Neon (reads ONLY) ---------------------------
//
// Neon intermittently refuses connections (P1001 / "Can't reach database
// server") or momentarily exhausts its pool (P2024). Those failures are
// almost always gone within a few hundred milliseconds, so idempotent READS
// silently retry up to twice with jittered backoff before rethrowing.
//
// WRITE safety is structural: create/update/delete/upsert/$executeRaw and
// anything else outside RETRYABLE_READ_ACTIONS passes through exactly once —
// their side effects are never replayed.

const RETRYABLE_READ_ACTIONS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
]);

const MAX_RETRIES = 2;
const BASE_DELAY_MS = 150;
const JITTER_MS = 150;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransient(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return (
    e?.code === "P1001" ||
    e?.code === "P2024" ||
    e instanceof Prisma.PrismaClientInitializationError ||
    /can't reach database server/i.test(e?.message ?? "")
  );
}

function makeClient() {
  const base = new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

  return base.$extends({
    query: {
      async $allOperations({ operation, args, query }) {
        // Non-read operations: single attempt, no interception overhead
        // beyond the pass-through.
        if (!RETRYABLE_READ_ACTIONS.has(operation)) return query(args);

        let attempt = 0;
        for (;;) {
          try {
            return await query(args);
          } catch (err) {
            if (!isTransient(err) || attempt >= MAX_RETRIES) throw err;
            attempt += 1;
            const delay = BASE_DELAY_MS + Math.random() * JITTER_MS;
            console.warn(
              `[prisma-retry] ${operation} transient failure (${
                (err as { code?: string }).code ?? "init"
              }), retry ${attempt}/${MAX_RETRIES} in ${Math.round(delay)}ms`
            );
            await sleep(delay);
          }
        }
      },
    },
  });
}

// Avoid creating a new Prisma client on every HMR reload in development.
const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof makeClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Explicit retry for IDEMPOTENT writes only (upserts keyed by unique
// constraints, updateMany with fixed payloads, deletes). Replay is safe:
// a retried upsert converges to the same row state. Never wrap
// create/delete-once flows whose replay would duplicate or destroy.
export async function withIdempotentWriteRetry<T>(fn: () => Promise<T>): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      if (!isTransient(err) || attempt >= MAX_RETRIES) throw err;
      attempt += 1;
      const delay = BASE_DELAY_MS + Math.random() * JITTER_MS;
      console.warn(
        `[prisma-retry] idempotent write transient failure (${
          (err as { code?: string }).code ?? "init"
        }), retry ${attempt}/${MAX_RETRIES} in ${Math.round(delay)}ms`
      );
      await sleep(delay);
    }
  }
}
