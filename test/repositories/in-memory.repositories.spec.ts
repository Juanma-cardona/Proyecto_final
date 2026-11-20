import { describe, expect, it } from "vitest";
import { InMemoryMovementRepository } from "../../src/repositories/in-memory/movement.repository";
import { InMemoryProductRepository } from "../../src/repositories/in-memory/product.repository";
import { InMemoryStockRepository } from "../../src/repositories/in-memory/stock.repository";
import { InMemoryWarehouseRepository } from "../../src/repositories/in-memory/warehouse.repository";
import { AppError } from "../../src/exceptions/errors/app.error";
import { AppException } from "../../src/exceptions/app.exception";
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

    it("should reject a duplicate product code without replacing the existing product", async () => {
        const repo = new InMemoryProductRepository();
        await repo.save(makeProduct({ id: "p1", code: "A-1" }));

        await expect(repo.save(makeProduct({ id: "p2", code: "A-1" }))).rejects.toMatchObject({
            code: AppError.PRODUCT_CODE_DUPLICATED.code,
        } satisfies Partial<AppException>);
        expect(await repo.findById("p1")).not.toBeNull();
        expect(await repo.findById("p2")).toBeNull();
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

describe("InMemoryProductRepository.findByIds", () => {
    it("should return only the products that exist", async () => {
        const repo = new InMemoryProductRepository();
        await repo.save(makeProduct({ id: "p1", code: "A-1" }));
        await repo.save(makeProduct({ id: "p2", code: "B-2" }));

        const found = await repo.findByIds(["p1", "nope", "p2"]);

        expect(found.map((product) => product.id).sort()).toEqual(["p1", "p2"]);
    });

    it("should not repeat a product when its id is requested twice", async () => {
        const repo = new InMemoryProductRepository();
        await repo.save(makeProduct({ id: "p1" }));

        expect(await repo.findByIds(["p1", "p1"])).toHaveLength(1);
    });

    it("should return an empty list for an empty list of ids", async () => {
        const repo = new InMemoryProductRepository();
        await repo.save(makeProduct({ id: "p1" }));

        expect(await repo.findByIds([])).toEqual([]);
    });

    it("should return copies and not the internal objects", async () => {
        const repo = new InMemoryProductRepository();
        await repo.save(makeProduct({ id: "p1", name: "Original" }));

        const [found] = await repo.findByIds(["p1"]);
        found!.name = "Mutated";

        expect((await repo.findById("p1"))?.name).toBe("Original");
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
        const products = new InMemoryProductRepository();
        await products.save(makeProduct({ id: "p1", code: "A-1", name: "Alfa" }));
        await products.save(makeProduct({ id: "p2", code: "B-2", name: "Beta" }));
        await products.save(makeProduct({ id: "p3", code: "C-3", name: "Gamma" }));
        const repo = new InMemoryStockRepository(products);
        await repo.setQuantity("BOG", "p1", 1);
        await repo.setQuantity("BOG", "p2", 2);
        await repo.setQuantity("BOG", "p3", 3);
        await repo.setQuantity("MED", "p9", 9);

        const first = await repo.listByWarehouse("BOG", 0, 2);
        const second = await repo.listByWarehouse("BOG", 2, 2);

        expect(first.total).toBe(3);
        expect(first.items).toEqual([
            { warehouseId: "BOG", productId: "p1", productCode: "A-1", productName: "Alfa", quantity: 1 },
            { warehouseId: "BOG", productId: "p2", productCode: "B-2", productName: "Beta", quantity: 2 },
        ]);
        expect(second.items).toEqual([
            { warehouseId: "BOG", productId: "p3", productCode: "C-3", productName: "Gamma", quantity: 3 },
        ]);
    });

    it("should mark the product as UNKNOWN when it does not exist or there is no product repository", async () => {
        const withProducts = new InMemoryStockRepository(new InMemoryProductRepository());
        await withProducts.setQuantity("BOG", "ghost", 2);
        const alone = new InMemoryStockRepository();
        await alone.setQuantity("BOG", "p1", 4);

        expect((await withProducts.listByWarehouse("BOG", 0, 10)).items).toEqual([
            { warehouseId: "BOG", productId: "ghost", productCode: "UNKNOWN", productName: "UNKNOWN", quantity: 2 },
        ]);
        expect((await alone.listByWarehouse("BOG", 0, 10)).items[0]).toMatchObject({
            productCode: "UNKNOWN",
            productName: "UNKNOWN",
            quantity: 4,
        });
    });

    it("should read the balances of one product in several warehouses at once (0 when there is no record)", async () => {
        const repo = new InMemoryStockRepository();
        await repo.setQuantity("BOG", "p1", 10);

        const balances = await repo.getQuantities("p1", ["BOG", "MED"]);

        expect(balances).toEqual(new Map([["BOG", 10], ["MED", 0]]));
    });

    it("should write the balances of one product in several warehouses at once", async () => {
        const repo = new InMemoryStockRepository();

        await repo.setQuantities("p1", [
            { warehouseId: "BOG", quantity: 7 },
            { warehouseId: "MED", quantity: 3 },
        ]);

        expect(await repo.getQuantity("BOG", "p1")).toBe(7);
        expect(await repo.getQuantity("MED", "p1")).toBe(3);
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

    it("should save several movements at once and return copies", async () => {
        const repo = new InMemoryMovementRepository();
        const base = {
            type: "TRANSFER_OUT" as const, warehouseId: "BOG", productId: "p1", quantity: 5,
            balanceAfter: 5, reason: null, transferId: "t1", responsibleId: "u1", createdAt: new Date(),
        };
        const movements = [{ ...base, id: "m1" }, { ...base, id: "m2", type: "TRANSFER_IN" as const }];

        const saved = await repo.saveMany(movements);

        expect(saved).toEqual(movements);
        expect(saved[0]).not.toBe(movements[0]);
    });
});
