import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../../prisma/generated/client";

const connectionString = `${process.env.DATABASE_URL}`;

const adapter = new PrismaBetterSqlite3({ url: connectionString });
const base = new PrismaClient({ adapter });

// Query-count seam (issue #45 perf harness). When TEST_HOOKS=1, every Prisma
// operation (including those inside interactive transactions) increments
// `queryCounter.count`. A middleware resets it per-request and a Nitro plugin
// returns it via the `x-query-count` response header, so e2e tests can pin
// N+1 / unbounded-query regressions (e.g. #24) with a failing test. A complete
// no-op in production: without TEST_HOOKS the base client is exported unchanged.
export const queryCounter = { count: 0 };

const prisma =
  process.env.TEST_HOOKS === "1"
    ? base.$extends({
        query: {
          async $allOperations({ args, query }) {
            queryCounter.count++;
            return query(args);
          },
        },
      })
    : base;

export { prisma };
