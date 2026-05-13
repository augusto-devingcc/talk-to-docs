import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';

const globalForPool = globalThis as unknown as { __ttd_pgPool?: Pool };

function getPool(): Pool {
  if (!globalForPool.__ttd_pgPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set');
    }
    globalForPool.__ttd_pgPool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
    });
  }
  return globalForPool.__ttd_pgPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: ReadonlyArray<unknown>,
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params as unknown[] | undefined);
}

export async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export function toVectorLiteral(values: number[]): string {
  return `[${values.join(',')}]`;
}
