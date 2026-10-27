import { AsyncLocalStorage } from "node:async_hooks";
import { ConnectionPool, DateTime2, Request, Transaction, type config as SqlConfig } from "mssql";
import {
    ISqlExecutor,
    ITransactionManager,
    SqlParams,
} from "../repositories/interfaces/database.interface";

/**
 * Conexión a SQL Server. Hace dos trabajos:
 * - query(): ejecuta SQL. Si hay una transacción abierta, la usa automáticamente.
 * - run(): abre una transacción para todo lo que ocurra dentro de `work`.
 *
 * Los repositorios solo conocen ISqlExecutor, así que no saben si están dentro de una transacción.
 */
export class SqlServerDatabase implements ISqlExecutor, ITransactionManager {
    private readonly pool: ConnectionPool;
    private readonly transactions = new AsyncLocalStorage<Transaction>();

    constructor(config: SqlConfig) {
        this.pool = new ConnectionPool(config);
    }

    async connect(): Promise<void> {
        await this.pool.connect();
    }

    async close(): Promise<void> {
        await this.pool.close();
    }

    async query<T>(sqlText: string, params: SqlParams = {}): Promise<T[]> {
        const request = new Request(this.transactions.getStore() ?? this.pool);

        for (const [name, value] of Object.entries(params)) {
            if (value instanceof Date) {
                request.input(name, DateTime2, value);
            } else {
                request.input(name, value);
            }
        }

        const result = await request.query<T>(sqlText);
        return result.recordset ?? [];
    }

    async run<T>(work: () => Promise<T>): Promise<T> {
        // Si ya hay una transacción abierta, se reutiliza.
        if (this.transactions.getStore()) {
            return work();
        }

        const transaction = new Transaction(this.pool);
        await transaction.begin();

        try {
            const result = await this.transactions.run(transaction, work);
            await transaction.commit();
            return result;
        } catch (error) {
            try {
                await transaction.rollback();
            } catch {
                // La transacción ya había sido revertida por el servidor.
            }
            throw error;
        }
    }
}
