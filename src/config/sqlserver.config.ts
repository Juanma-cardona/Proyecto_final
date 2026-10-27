import type { config as SqlConfig } from "mssql";

type Env = Record<string, string | undefined>;

const required = (env: Env, name: string): string => {
    const value = env[name];
    if (!value) {
        throw new Error(`Missing environment variable ${name}. Check your .env file.`);
    }
    return value;
};

export const loadSqlServerConfig = (env: Env = process.env): SqlConfig => ({
    server: required(env, "DB_SERVER"),
    port: Number(env.DB_PORT ?? 1433),
    database: required(env, "DB_NAME"),
    user: required(env, "DB_USER"),
    password: required(env, "DB_PASSWORD"),
    options: {
        encrypt: env.DB_ENCRYPT === "true",
        trustServerCertificate: env.DB_TRUST_SERVER_CERT !== "false",
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
});
