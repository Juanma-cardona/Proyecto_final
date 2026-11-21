import { AsyncLocalStorage } from "node:async_hooks";
import { Pool, type PoolClient } from "pg";
import { ISqlExecutor, ITransactionManager, SqlParams } from "../repositories/interfaces/database.interface";

/** PostgreSQL executor for Supabase's transaction pooler and other PostgreSQL hosts. */
export class PostgresDatabase implements ISqlExecutor, ITransactionManager {
    private readonly pool: Pool;
    private readonly transactions = new AsyncLocalStorage<PoolClient>();

    constructor(connectionString: string | undefined, env: Record<string, string | undefined> = process.env) {
        if (!connectionString) {
            throw new Error("Missing environment variable DATABASE_URL. Set the Supabase transaction pooler URL.");
        }

        this.pool = new Pool({
            connectionString,
            // Keep one client per serverless instance; Supavisor shares the server-side connections.
            max: Number(env.PG_POOL_MAX ?? 1),
            connectionTimeoutMillis: Number(env.DB_CONNECTION_TIMEOUT ?? 15000),
            idleTimeoutMillis: Number(env.DB_IDLE_TIMEOUT ?? 30000),
            ssl: { rejectUnauthorized: false },
        });
        this.pool.on("error", (error: unknown) => {
            console.error("PostgreSQL pool error:", error);
        });
    }

    async connect(): Promise<void> {
        await this.pool.query("SELECT 1");
    }

    async close(): Promise<void> {
        await this.pool.end();
    }

    async query<T>(sqlText: string, params: SqlParams = {}): Promise<T[]> {
        const values: SqlParams[keyof SqlParams][] = [];
        const positions = new Map<string, number>();
        const sql = sqlText.replace(/@([A-Za-z][A-Za-z0-9_]*)/g, (_match, name: string) => {
            let position = positions.get(name);
            if (position === undefined) {
                const value = params[name];
                if (value === undefined) throw new Error(`Missing SQL parameter: ${name}`);
                values.push(value);
                position = values.length;
                positions.set(name, position);
            }
            return `$${position}`;
        });

        const client = this.transactions.getStore() ?? this.pool;
        const result = await client.query(sql, values);
        return result.rows as T[];
    }

    async run<T>(work: () => Promise<T>): Promise<T> {
        if (this.transactions.getStore()) return work();

        const client = await this.pool.connect();
        try {
            await client.query("BEGIN");
            const result = await this.transactions.run(client, work);
            await client.query("COMMIT");
            return result;
        } catch (error) {
            try {
                await client.query("ROLLBACK");
            } catch {
                // Keep the original failure if PostgreSQL already aborted the transaction.
            }
            throw error;
        } finally {
            client.release();
        }
    }
}
