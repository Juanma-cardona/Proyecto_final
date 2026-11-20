import type { config as SqlConfig } from "mssql";

type Env = Record<string, string | undefined>;

const required = (env: Env, name: string): string => {
    const value = env[name];
    if (!value) {
        throw new Error(`Missing environment variable ${name}. Check your .env file.`);
    }
    return value;
};

export const loadSqlServerConfig = (env: Env = process.env): SqlConfig => {
    // Máximo de conexiones simultáneas a SQL Server.
    const poolMax = Number(env.DB_POOL_MAX ?? 250);
    // Conexiones que se abren al arrancar y se mantienen abiertas (por defecto 0: se abren a demanda).
    // Abrirlas antes del tráfico evita que una subida brusca de usuarios dispare cientos de inicios de sesión
    // a la vez, que es lo que produce "Failed to connect to localhost:1433 in 15000ms".
    const poolMin = Math.min(Number(env.DB_POOL_MIN ?? 0), poolMax);

    return {
        server: required(env, "DB_SERVER"),
        port: Number(env.DB_PORT ?? 1433),
        database: required(env, "DB_NAME"),
        user: required(env, "DB_USER"),
        password: required(env, "DB_PASSWORD"),
        // Milisegundos que se espera a que SQL Server complete una conexión nueva (por defecto 15000, como el driver).
        connectionTimeout: Number(env.DB_CONNECTION_TIMEOUT ?? 15000),
        options: {
            // Si DB_ENCRYPT no está definida, se usa el valor por defecto del driver (cifrado activado).
            ...(env.DB_ENCRYPT !== undefined ? { encrypt: env.DB_ENCRYPT === "true" } : {}),
            trustServerCertificate: env.DB_TRUST_SERVER_CERT !== "false",
        },
        pool: { max: poolMax, min: poolMin, idleTimeoutMillis: 30000 },
    };
};
