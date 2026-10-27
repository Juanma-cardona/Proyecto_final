import { beforeEach, describe, expect, it, vi, type Mocked } from "vitest";
import { AppException } from "../../src/exceptions/app.exception";
import { ISqlExecutor } from "../../src/repositories/interfaces/database.interface";
import { SqlServerMovementRepository } from "../../src/repositories/sqlserver/movement.repository";
import { SqlServerProductRepository } from "../../src/repositories/sqlserver/product.repository";
import { SqlServerStockRepository } from "../../src/repositories/sqlserver/stock.repository";
import { SqlServerWarehouseRepository } from "../../src/repositories/sqlserver/warehouse.repository";
import { makeProduct } from "../helpers/mocks";

const createExecutorMock = (): Mocked<ISqlExecutor> =>
    ({ query: vi.fn().mockResolvedValue([]) }) as unknown as Mocked<ISqlExecutor>;

/** Devuelve el texto SQL y los parámetros de la llamada número `index` (empezando en 0). */
const callAt = (executor: Mocked<ISqlExecutor>, index = 0) => {
    const [sql, params] = executor.query.mock.calls[index] as unknown as [string, Record<string, unknown>];
    return { sql, params };
};

describe("SqlServerProductRepository", () => {
    let executor: Mocked<ISqlExecutor>;
    let repository: SqlServerProductRepository;

    beforeEach(() => {
        executor = createExecutorMock();
        repository = new SqlServerProductRepository(executor);
    });

    it("should save the product with a MERGE and return a copy of it", async () => {
        const product = makeProduct({ description: "Acero" });

        const saved = await repository.save(product);

        const { sql, params } = callAt(executor);
        expect(sql).toMatch(/MERGE dbo\.products/);
        expect(params).toEqual({
            id: product.id,
            code: product.code,
            name: product.name,
            description: "Acero",
            active: true,
            createdAt: product.createdAt,
        });
        expect(saved).toEqual(product);
        expect(saved).not.toBe(product);
    });

    it("should turn a duplicated code (SQL Server errors 2627 and 2601) into PRODUCT_CODE_DUPLICATED", async () => {
        for (const number of [2627, 2601]) {
            executor.query.mockRejectedValueOnce(Object.assign(new Error("duplicate key"), { number }));

            const promise = repository.save(makeProduct());

            await expect(promise).rejects.toBeInstanceOf(AppException);
            await expect(promise).rejects.toMatchObject({ code: "PRODUCT_CODE_DUPLICATED", statusCode: 409 });
        }
    });

    it("should rethrow any other database error as it is", async () => {
        const error = Object.assign(new Error("timeout"), { number: 1205 });
        executor.query.mockRejectedValueOnce(error);

        await expect(repository.save(makeProduct())).rejects.toBe(error);
    });

    it("should rethrow errors that have no error number", async () => {
        executor.query.mockRejectedValueOnce(new Error("connection lost"));

        await expect(repository.save(makeProduct())).rejects.toThrow("connection lost");
    });

    it("should find a product by id and map the columns to the entity", async () => {
        const createdAt = new Date("2026-01-01T00:00:00.000Z");
        executor.query.mockResolvedValueOnce([
            { id: "p-1", code: "TOR-001", name: "Tornillo", description: null, active: false, created_at: createdAt },
        ]);

        const found = await repository.findById("p-1");

        const { sql, params } = callAt(executor);
        expect(sql).toMatch(/FROM dbo\.products WHERE id = @id/);
        expect(params).toEqual({ id: "p-1" });
        expect(found).toEqual({
            id: "p-1",
            code: "TOR-001",
            name: "Tornillo",
            description: null,
            active: false,
            createdAt,
        });
    });

    it("should return null when the product id does not exist", async () => {
        await expect(repository.findById("nope")).resolves.toBeNull();
    });

    it("should find a product by code", async () => {
        executor.query.mockResolvedValueOnce([
            { id: "p-1", code: "TOR-001", name: "Tornillo", description: "x", active: true, created_at: new Date() },
        ]);

        const found = await repository.findByCode("TOR-001");

        const { sql, params } = callAt(executor);
        expect(sql).toMatch(/WHERE code = @code/);
        expect(params).toEqual({ code: "TOR-001" });
        expect(found?.id).toBe("p-1");
    });

    it("should return null when the product code does not exist", async () => {
        await expect(repository.findByCode("NOPE")).resolves.toBeNull();
    });
});

describe("SqlServerWarehouseRepository", () => {
    it("should find a warehouse by id", async () => {
        const executor = createExecutorMock();
        executor.query.mockResolvedValueOnce([{ id: "BOG", name: "Bodega Bogotá", city: "Bogotá" }]);

        const found = await new SqlServerWarehouseRepository(executor).findById("BOG");

        const { sql, params } = callAt(executor);
        expect(sql).toMatch(/FROM dbo\.warehouses WHERE id = @id/);
        expect(params).toEqual({ id: "BOG" });
        expect(found).toEqual({ id: "BOG", name: "Bodega Bogotá", city: "Bogotá" });
    });

    it("should return null when the warehouse does not exist", async () => {
        const executor = createExecutorMock();

        await expect(new SqlServerWarehouseRepository(executor).findById("XXX")).resolves.toBeNull();
    });
});

describe("SqlServerStockRepository", () => {
    let executor: Mocked<ISqlExecutor>;
    let repository: SqlServerStockRepository;

    beforeEach(() => {
        executor = createExecutorMock();
        repository = new SqlServerStockRepository(executor);
    });

    it("should read the quantity locking the row", async () => {
        executor.query.mockResolvedValueOnce([{ quantity: 35 }]);

        const quantity = await repository.getQuantity("BOG", "p-1");

        const { sql, params } = callAt(executor);
        expect(sql).toMatch(/FROM dbo\.stock WITH \(UPDLOCK, HOLDLOCK\)/);
        expect(params).toEqual({ warehouseId: "BOG", productId: "p-1" });
        expect(quantity).toBe(35);
    });

    it("should return 0 when the warehouse has no record of the product", async () => {
        await expect(repository.getQuantity("BOG", "p-1")).resolves.toBe(0);
    });

    it("should return 0 when the stored quantity is 0", async () => {
        executor.query.mockResolvedValueOnce([{ quantity: 0 }]);

        await expect(repository.getQuantity("BOG", "p-1")).resolves.toBe(0);
    });

    it("should save the quantity with a MERGE (insert or update)", async () => {
        await repository.setQuantity("MED", "p-1", 12);

        const { sql, params } = callAt(executor);
        expect(sql).toMatch(/MERGE dbo\.stock/);
        expect(sql).toMatch(/WHEN MATCHED THEN UPDATE/);
        expect(sql).toMatch(/WHEN NOT MATCHED THEN/);
        expect(params).toEqual({ warehouseId: "MED", productId: "p-1", quantity: 12 });
    });

    it("should list a page of stock and the total", async () => {
        executor.query
            .mockResolvedValueOnce([
                { product_id: "p-1", quantity: 5 },
                { product_id: "p-2", quantity: 0 },
            ])
            .mockResolvedValueOnce([{ total: 7 }]);

        const result = await repository.listByWarehouse("BOG", 10, 2);

        const page = callAt(executor, 0);
        expect(page.sql).toMatch(/OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY/);
        expect(page.params).toEqual({ warehouseId: "BOG", offset: 10, limit: 2 });
        const count = callAt(executor, 1);
        expect(count.sql).toMatch(/COUNT\(\*\)/);
        expect(count.params).toEqual({ warehouseId: "BOG" });
        expect(result).toEqual({
            items: [
                { warehouseId: "BOG", productId: "p-1", quantity: 5 },
                { warehouseId: "BOG", productId: "p-2", quantity: 0 },
            ],
            total: 7,
        });
    });

    it("should list an empty page with total 0 when there is no stock", async () => {
        await expect(repository.listByWarehouse("CAL", 0, 10)).resolves.toEqual({ items: [], total: 0 });
    });
});

describe("SqlServerMovementRepository", () => {
    it("should insert the movement and return a copy of it", async () => {
        const executor = createExecutorMock();
        const movement = {
            id: "m-1",
            type: "TRANSFER_OUT" as const,
            warehouseId: "BOG",
            productId: "p-1",
            quantity: 20,
            balanceAfter: 30,
            reason: null,
            transferId: "t-1",
            responsibleId: "u-1",
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
        };

        const saved = await new SqlServerMovementRepository(executor).save(movement);

        const { sql, params } = callAt(executor);
        expect(sql).toMatch(/INSERT INTO dbo\.movements/);
        expect(params).toEqual({
            id: "m-1",
            type: "TRANSFER_OUT",
            warehouseId: "BOG",
            productId: "p-1",
            quantity: 20,
            balanceAfter: 30,
            reason: null,
            transferId: "t-1",
            responsibleId: "u-1",
            createdAt: movement.createdAt,
        });
        expect(saved).toEqual(movement);
        expect(saved).not.toBe(movement);
    });
});
