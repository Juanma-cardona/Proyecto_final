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

    it("should use port 1433, no encryption and trust the certificate by default", () => {
        const config = loadSqlServerConfig(env);

        expect(config.port).toBe(1433);
        expect(config.options).toMatchObject({ encrypt: false, trustServerCertificate: true });
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
