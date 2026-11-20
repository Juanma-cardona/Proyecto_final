import { describe, expect, it } from "vitest";
import { loadSqlServerConfig } from "../../src/config/sqlserver.config";

describe("loadSqlServerConfig", () => {
    const env = {
        DB_SERVER: "localhost",
        DB_NAME: "BodegasDB",
        DB_USER: "sa",
        DB_PASSWORD: "secret",
    };

    it("should build the configuration from the environment variables", () => {
        const config = loadSqlServerConfig(env);

        expect(config).toMatchObject({
            server: "localhost",
            database: "BodegasDB",
            user: "sa",
            password: "secret",
        });
    });

    it("should use port 1433 and trust the certificate by default", () => {
        const config = loadSqlServerConfig(env);

        expect(config.port).toBe(1433);
        expect(config.options).toMatchObject({ trustServerCertificate: true });
    });

    it("should leave the encryption to the driver default when DB_ENCRYPT is not defined", () => {
        const config = loadSqlServerConfig(env);

        expect(config.options?.encrypt).toBeUndefined();
    });

    it("should read the optional port and security settings", () => {
        const config = loadSqlServerConfig({
            ...env,
            DB_PORT: "1450",
            DB_ENCRYPT: "true",
            DB_TRUST_SERVER_CERT: "false",
        });

        expect(config.port).toBe(1450);
        expect(config.options).toMatchObject({ encrypt: true, trustServerCertificate: false });
    });

    it("should turn the encryption off only when DB_ENCRYPT is explicitly false", () => {
        expect(loadSqlServerConfig({ ...env, DB_ENCRYPT: "false" }).options?.encrypt).toBe(false);
        expect(loadSqlServerConfig({ ...env, DB_ENCRYPT: "true" }).options?.encrypt).toBe(true);
    });

    it("should use a pool of at most 250 connections and no pre-opened connections by default", () => {
        const config = loadSqlServerConfig(env);

        expect(config.pool).toMatchObject({ max: 250, min: 0 });
    });

    it("should read the number of connections to keep open from DB_POOL_MIN", () => {
        const config = loadSqlServerConfig({ ...env, DB_POOL_MAX: "100", DB_POOL_MIN: "40" });

        expect(config.pool).toMatchObject({ max: 100, min: 40 });
    });

    it("should never keep more connections open than the maximum", () => {
        const config = loadSqlServerConfig({ ...env, DB_POOL_MAX: "20", DB_POOL_MIN: "50" });

        expect(config.pool).toMatchObject({ max: 20, min: 20 });
    });

    it("should wait 15 seconds for a new connection by default and read DB_CONNECTION_TIMEOUT", () => {
        expect(loadSqlServerConfig(env).connectionTimeout).toBe(15000);
        expect(loadSqlServerConfig({ ...env, DB_CONNECTION_TIMEOUT: "30000" }).connectionTimeout).toBe(30000);
    });

    it("should read the maximum number of connections from DB_POOL_MAX", () => {
        const config = loadSqlServerConfig({ ...env, DB_POOL_MAX: "1000" });

        expect(config.pool?.max).toBe(1000);
    });

    it.each(["DB_SERVER", "DB_NAME", "DB_USER", "DB_PASSWORD"])(
        "should fail naming the variable %s when it is missing",
        (name) => {
            const incomplete: Record<string, string | undefined> = { ...env, [name]: undefined };

            expect(() => loadSqlServerConfig(incomplete)).toThrow(name);
        }
    );

    it("should fail when a required variable is empty", () => {
        expect(() => loadSqlServerConfig({ ...env, DB_PASSWORD: "" })).toThrow("DB_PASSWORD");
    });
});
