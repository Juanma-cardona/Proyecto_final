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
    private readonly warmUpConnections: number;

    constructor(config: SqlConfig) {
        this.pool = new ConnectionPool(config);
        this.pool.on("error", (error: unknown) => {
            console.error("SQL Server connection pool error:", error);
        });
        this.warmUpConnections = Math.min(config.pool?.min ?? 0, config.pool?.max ?? 10);
    }

    async connect(): Promise<void> {
        await this.pool.connect();
        await this.warmUp();
    }

    /**
     * Abre `pool.min` conexiones antes de recibir tráfico, de 10 en 10 para no saturar el inicio de sesión
     * de SQL Server. Cada consulta espera 200 ms para que se necesiten conexiones distintas a la vez.
     * Si falla, la API arranca igual: las conexiones se abrirán a demanda.
     */
    private async warmUp(): Promise<void> {
        const BATCH_SIZE = 10;
        try {
            for (let opened = 0; opened < this.warmUpConnections; opened += BATCH_SIZE) {
                const size = Math.min(BATCH_SIZE, this.warmUpConnections - opened);
                await Promise.all(
                    Array.from({ length: size }, () => new Request(this.pool).query("WAITFOR DELAY '00:00:00.200'"))
                );
            }
        } catch (error) {
            console.warn("Could not warm up the connection pool:", error);
        }
    }

    async close(): Promise<void> {
        await this.pool.close();
    }

    async query<T>(sqlText: string, params: SqlParams = {}): Promise<T[]> {
        const transaction = this.transactions.getStore();
        const request = transaction ? new Request(transaction) : new Request(this.pool);

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
