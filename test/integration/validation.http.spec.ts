import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createServer } from "../../src/server";

/** Prueba de punta a punta: peticiones HTTP reales contra las rutas con Zod activo. */
describe("HTTP validation with Zod", () => {
    let server: Server;
    let baseUrl: string;

    beforeAll(async () => {
        await new Promise<void>((resolve) => {
            server = createServer().listen(0, () => resolve());
        });
        baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
    });

    afterAll(async () => {
        await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    const send = async (method: string, path: string, body?: unknown) => {
        const response = await fetch(`${baseUrl}${path}`, {
            method,
            headers: { "Content-Type": "application/json" },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        return { status: response.status, body: (await response.json()) as Record<string, unknown> };
    };

    it("should answer 400 PRODUCT_CODE_REQUIRED when the code is not text (instead of a 500)", async () => {
        const res = await send("POST", "/products", { code: 123, name: "Tornillo" });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe("PRODUCT_CODE_REQUIRED");
    });

    it("should answer 400 PRODUCT_CODE_REQUIRED when the body is empty", async () => {
        const res = await send("POST", "/products");

        expect(res.status).toBe(400);
        expect(res.body.code).toBe("PRODUCT_CODE_REQUIRED");
    });

    it("should answer 400 VALIDATION_ERROR when the body is not an object", async () => {
        const res = await send("POST", "/products", []);

        expect(res.status).toBe(400);
        expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("should create a product when the data is valid", async () => {
        const res = await send("POST", "/products", { code: "zod-int-001", name: "Tornillo" });

        expect(res.status).toBe(201);
        expect(res.body.code).toBe("ZOD-INT-001");
    });

    it("should answer 400 INVALID_STATUS when active is not a boolean", async () => {
        const res = await send("PATCH", "/products/cualquier-id/status", { active: "yes" });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe("INVALID_STATUS");
    });

    it("should answer 400 INVALID_PAGINATION for a bad page or limit", async () => {
        const badPage = await send("GET", "/warehouses/BOG/stock?page=0");
        const badLimit = await send("GET", "/warehouses/BOG/stock?limit=abc");

        expect(badPage).toMatchObject({ status: 400, body: { code: "INVALID_PAGINATION" } });
        expect(badLimit).toMatchObject({ status: 400, body: { code: "INVALID_PAGINATION" } });
    });

    it("should answer 200 for a valid pagination", async () => {
        const res = await send("GET", "/warehouses/BOG/stock?page=1&limit=10");

        expect(res.status).toBe(200);
    });

    it("should answer 400 for invalid adjustments", async () => {
        const base = { warehouseId: "BOG", productId: "p", quantity: 5, reason: "Conteo físico", responsibleId: "u" };

        const zero = await send("POST", "/stock/adjustments", { ...base, quantity: 0 });
        const shortReason = await send("POST", "/stock/adjustments", { ...base, reason: "abc" });
        const noResponsible = await send("POST", "/stock/adjustments", { ...base, responsibleId: "" });

        expect(zero.body.code).toBe("INVALID_QUANTITY");
        expect(shortReason.body.code).toBe("REASON_REQUIRED");
        expect(noResponsible.body.code).toBe("RESPONSIBLE_REQUIRED");
        expect([zero.status, shortReason.status, noResponsible.status]).toEqual([400, 400, 400]);
    });

    it("should answer 400 INVALID_QUANTITY for a negative transfer quantity", async () => {
        const res = await send("POST", "/transfers", {
            originWarehouseId: "BOG",
            destinationWarehouseId: "MED",
            productId: "p",
            quantity: -40,
            responsibleId: "u",
        });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe("INVALID_QUANTITY");
    });
});
