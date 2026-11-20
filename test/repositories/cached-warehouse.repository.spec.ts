import { describe, expect, it, vi } from "vitest";
import { CachedWarehouseRepository } from "../../src/repositories/cache/cached-warehouse.repository";
import { IWarehouseRepository } from "../../src/repositories/interfaces/repositories.interface";
import { makeWarehouse } from "../helpers/mocks";

const createInner = (found: ReturnType<typeof makeWarehouse> | null = makeWarehouse()) => {
    const inner: IWarehouseRepository = { findById: vi.fn().mockResolvedValue(found) };
    return inner;
};

describe("CachedWarehouseRepository", () => {
    it("should query the database only once for repeated lookups of the same warehouse", async () => {
        const inner = createInner();
        const repo = new CachedWarehouseRepository(inner);

        const first = await repo.findById("BOG");
        const second = await repo.findById("BOG");

        expect(inner.findById).toHaveBeenCalledTimes(1);
        expect(first).toEqual(makeWarehouse());
        expect(second).toEqual(first);
    });

    it("should keep a separate entry per warehouse", async () => {
        const inner = createInner();
        const repo = new CachedWarehouseRepository(inner);

        await repo.findById("BOG");
        await repo.findById("MED");

        expect(inner.findById).toHaveBeenCalledTimes(2);
    });

    it("should query the database again once the entry has expired", async () => {
        const inner = createInner();
        let now = 1_000;
        const repo = new CachedWarehouseRepository(inner, 500, () => now);

        await repo.findById("BOG");
        now = 1_400;
        await repo.findById("BOG");
        expect(inner.findById).toHaveBeenCalledTimes(1);

        now = 1_600;
        await repo.findById("BOG");
        expect(inner.findById).toHaveBeenCalledTimes(2);
    });

    it("should not cache a warehouse that does not exist", async () => {
        const inner = createInner(null);
        const repo = new CachedWarehouseRepository(inner);

        expect(await repo.findById("XXX")).toBeNull();
        expect(await repo.findById("XXX")).toBeNull();

        expect(inner.findById).toHaveBeenCalledTimes(2);
    });

    it("should return copies so a caller can not change the cached warehouse", async () => {
        const repo = new CachedWarehouseRepository(createInner());

        const first = await repo.findById("BOG");
        first!.name = "Otro nombre";
        const second = await repo.findById("BOG");

        expect(second!.name).toBe("Bodega Bogotá");
    });
});
