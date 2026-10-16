import { describe, expect, it } from "vitest";
import { InMemoryMovementRepository } from "../../src/repositories/in-memory/movement.repository";
import { InMemoryProductRepository } from "../../src/repositories/in-memory/product.repository";
import { InMemoryStockRepository } from "../../src/repositories/in-memory/stock.repository";
import { InMemoryWarehouseRepository } from "../../src/repositories/in-memory/warehouse.repository";
import { makeProduct } from "../helpers/mocks";

describe("InMemoryProductRepository", () => {
    it("should save and find a product by id and by code", async () => {
        const repo = new InMemoryProductRepository();
        await repo.save(makeProduct({ id: "p1", code: "A-1" }));

        expect(await repo.findById("p1")).toMatchObject({ id: "p1", code: "A-1" });
        expect(await repo.findByCode("A-1")).toMatchObject({ id: "p1" });
    });

    it("should return null when the product does not exist", async () => {
        const repo = new InMemoryProductRepository();

        expect(await repo.findById("nope")).toBeNull();
        expect(await repo.findByCode("nope")).toBeNull();
    });

    it("should update an existing product when saved again with the same id", async () => {
        const repo = new InMemoryProductRepository();
        await repo.save(makeProduct({ id: "p1", active: true }));
        await repo.save(makeProduct({ id: "p1", active: false }));

        expect((await repo.findById("p1"))?.active).toBe(false);
    });

    it("should not leak internal state (returns copies)", async () => {
        const repo = new InMemoryProductRepository();
        const saved = await repo.save(makeProduct({ id: "p1", name: "Original" }));
        saved.name = "Mutated";
        const found = await repo.findById("p1");
        found!.name = "Mutated again";

        expect((await repo.findById("p1"))?.name).toBe("Original");
        expect((await repo.findByCode("TOR-001"))?.name).toBe("Original");
    });
});

describe("InMemoryWarehouseRepository", () => {
    it("should expose exactly the 3 default warehouses", async () => {
        const repo = new InMemoryWarehouseRepository();

        for (const id of ["BOG", "MED", "CAL"]) {
            expect(await repo.findById(id)).toMatchObject({ id });
        }
    });

    it("should return null for an unknown warehouse", async () => {
        expect(await new InMemoryWarehouseRepository().findById("XXX")).toBeNull();
    });
});

describe("InMemoryStockRepository", () => {
    it("should return 0 when there is no record", async () => {
        expect(await new InMemoryStockRepository().getQuantity("BOG", "p1")).toBe(0);
    });

    it("should keep independent stock per warehouse", async () => {
        const repo = new InMemoryStockRepository();
        await repo.setQuantity("BOG", "p1", 10);
        await repo.setQuantity("MED", "p1", 3);

        expect(await repo.getQuantity("BOG", "p1")).toBe(10);
        expect(await repo.getQuantity("MED", "p1")).toBe(3);
        expect(await repo.getQuantity("CAL", "p1")).toBe(0);
    });

    it("should list only the items of the requested warehouse with pagination", async () => {
        const repo = new InMemoryStockRepository();
        await repo.setQuantity("BOG", "p1", 1);
        await repo.setQuantity("BOG", "p2", 2);
        await repo.setQuantity("BOG", "p3", 3);
        await repo.setQuantity("MED", "p9", 9);

        const first = await repo.listByWarehouse("BOG", 0, 2);
        const second = await repo.listByWarehouse("BOG", 2, 2);

        expect(first.total).toBe(3);
        expect(first.items).toEqual([
            { warehouseId: "BOG", productId: "p1", quantity: 1 },
            { warehouseId: "BOG", productId: "p2", quantity: 2 },
        ]);
        expect(second.items).toEqual([{ warehouseId: "BOG", productId: "p3", quantity: 3 }]);
    });

    it("should return an empty list for a warehouse without stock", async () => {
        expect(await new InMemoryStockRepository().listByWarehouse("CAL", 0, 10)).toEqual({ items: [], total: 0 });
    });
});

describe("InMemoryMovementRepository", () => {
    it("should save a movement and return it", async () => {
        const repo = new InMemoryMovementRepository();
        const movement = {
            id: "m1", type: "ADJUSTMENT_IN" as const, warehouseId: "BOG", productId: "p1", quantity: 5,
            balanceAfter: 5, reason: "Carga inicial", transferId: null, responsibleId: "u1", createdAt: new Date(),
        };

        expect(await repo.save(movement)).toEqual(movement);
    });
});
