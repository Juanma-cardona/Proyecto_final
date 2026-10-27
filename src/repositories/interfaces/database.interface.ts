export type SqlValue = string | number | boolean | Date | null;
export type SqlParams = Readonly<Record<string, SqlValue>>;

/** Ejecuta una consulta SQL con parámetros con nombre (@nombre) y devuelve las filas. */
export interface ISqlExecutor {
    query<T>(sql: string, params?: SqlParams): Promise<T[]>;
}

/**
 * Ejecuta `work` como una unidad atómica: si termina bien se confirma (commit)
 * y si lanza un error se revierte todo (rollback).
 */
export interface ITransactionManager {
    run<T>(work: () => Promise<T>): Promise<T>;
}