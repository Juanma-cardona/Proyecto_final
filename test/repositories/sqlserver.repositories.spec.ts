import { beforeEach, describe, expect, it, vi, type Mocked } from "vitest";
import { AppException } from "../../src/exceptions/app.exception";
import { ISqlExecutor } from "../../src/repositories/interfaces/database.interface";
import { SqlServerMovementRepository } from "../../src/repositories/sqlserver/movement.repository";
import { SqlServerProductRepository } from "../../src/repositories/sqlserver/product.repository";
import { SqlServerStockRepository } from "../../src/repositories/sqlserver/stock.repository";
import { SqlServerStockMutationPersistence } from "../../src/repositories/sqlserver/stock-mutation.persistence";
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

    it("should update product status and return the updated row in one query", async () => {
        const createdAt = new Date("2026-01-01T00:00:00.000Z");
        executor.query.mockResolvedValueOnce([
            { id: "p-1", code: "TOR-001", name: "Tornillo", description: null, active: false, created_at: createdAt },
        ]);

        await expect(repository.updateStatus("p-1", false)).resolves.toEqual({
            id: "p-1", code: "TOR-001", name: "Tornillo", description: null, active: false, createdAt,
        });
        expect(executor.query).toHaveBeenCalledTimes(1);
        const { sql, params } = callAt(executor);
        expect(sql).toMatch(/UPDATE dbo\.products/);
        expect(sql).toMatch(/OUTPUT inserted\.id, inserted\.code/);
        expect(params).toEqual({ id: "p-1", active: false });
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

    it("should find several products with a single query using IN and one parameter per id", async () => {
        const createdAt = new Date("2026-01-01T00:00:00.000Z");
        executor.query.mockResolvedValueOnce([
            { id: "p-1", code: "A-1", name: "Uno", description: null, active: true, created_at: createdAt },
            { id: "p-2", code: "B-2", name: "Dos", description: "x", active: false, created_at: createdAt },
        ]);

        const found = await repository.findByIds(["p-1", "p-2"]);

        expect(executor.query).toHaveBeenCalledTimes(1);
        const { sql, params } = callAt(executor);
        expect(sql).toMatch(/FROM dbo\.products WHERE id IN \(@id0, @id1\)/);
        expect(params).toEqual({ id0: "p-1", id1: "p-2" });
        expect(found).toEqual([
            { id: "p-1", code: "A-1", name: "Uno", description: null, active: true, createdAt },
            { id: "p-2", code: "B-2", name: "Dos", description: "x", active: false, createdAt },
        ]);
    });

    it("should not repeat an id in the query when it is requested twice", async () => {
        await repository.findByIds(["p-1", "p-1", "p-2"]);

        const { sql, params } = callAt(executor);
        expect(sql).toMatch(/IN \(@id0, @id1\)/);
        expect(params).toEqual({ id0: "p-1", id1: "p-2" });
    });

    it("should not query the database when there are no ids", async () => {
        await expect(repository.findByIds([])).resolves.toEqual([]);

        expect(executor.query).not.toHaveBeenCalled();
    });

    it("should return only the rows that exist", async () => {
        executor.query.mockResolvedValueOnce([
            { id: "p-1", code: "A-1", name: "Uno", description: null, active: true, created_at: new Date() },
        ]);

        const found = await repository.findByIds(["p-1", "ghost"]);

        expect(found.map((product) => product.id)).toEqual(["p-1"]);
    });
});

describe("SqlServerStockMutationPersistence", () => {
    it("should adjust stock and insert its movement in one database call", async () => {
        const executor = createExecutorMock();
        const createdAt = new Date("2026-01-01T00:00:00.000Z");
        executor.query.mockResolvedValueOnce([{ previousBalance: 10, newBalance: 11 }]);
        const stockRepository = new SqlServerStockRepository(executor);
        const invalidate = vi.spyOn(stockRepository, "invalidateWarehouseCounts");
        const persistence = new SqlServerStockMutationPersistence(executor, stockRepository);

        await expect(persistence.adjustStock({
            warehouseId: "BOG", productId: "p-1", quantity: 1, reason: "Count", responsibleId: "u-1",
            movementId: "m-1", createdAt,
        })).resolves.toEqual({ previousBalance: 10, newBalance: 11 });

        expect(executor.query).toHaveBeenCalledTimes(1);
        const { sql, params } = callAt(executor);
        expect(sql).toMatch(/UPDLOCK, HOLDLOCK/);
        expect(sql).toMatch(/MERGE dbo\.stock/);
        expect(sql).toMatch(/INSERT INTO dbo\.movements/);
        expect(params).toMatchObject({
            warehouseId: "BOG", productId: "p-1", quantity: 1, movementId: "m-1",
        });
        expect(invalidate).toHaveBeenCalledWith(["BOG"]);
    });

    it("should read both locked balances, update stock and write movements in one call", async () => {
        const executor = createExecutorMock();
        const createdAt = new Date("2026-01-01T00:00:00.000Z");
        executor.query.mockResolvedValueOnce([{ originBalance: 6, destinationBalance: 4 }]);
        const stockRepository = new SqlServerStockRepository(executor);
        const invalidate = vi.spyOn(stockRepository, "invalidateWarehouseCounts");
        const persistence = new SqlServerStockMutationPersistence(executor, stockRepository);

        await expect(persistence.transfer({
            productId: "p-1", originWarehouseId: "BOG", destinationWarehouseId: "MED", quantity: 4,
            responsibleId: "u-1", transferId: "t-1", outMovementId: "m-1", inMovementId: "m-2", createdAt,
        })).resolves.toEqual({ originBalance: 6, destinationBalance: 4 });

        expect(executor.query).toHaveBeenCalledTimes(1);
        const { sql, params } = callAt(executor);
        expect(sql).toMatch(/UPDLOCK, HOLDLOCK/);
        expect(sql).toMatch(/MERGE dbo\.stock/);
        expect(sql).toMatch(/INSERT INTO dbo\.movements/);
        expect(params).toMatchObject({ productId: "p-1", originWarehouseId: "BOG", destinationWarehouseId: "MED", quantity: 4 });
        expect(invalidate).toHaveBeenCalledWith(["BOG", "MED"]);
    });

    it("should map SQL insufficient-stock errors to the application error", async () => {
        const executor = createExecutorMock();
        executor.query.mockRejectedValueOnce(Object.assign(new Error("insufficient stock"), { number: 51003 }));
        const persistence = new SqlServerStockMutationPersistence(executor, new SqlServerStockRepository(executor));

        await expect(persistence.transfer({
            productId: "p-1", originWarehouseId: "BOG", destinationWarehouseId: "MED", quantity: 4,
            responsibleId: "u-1", transferId: "t-1", outMovementId: "m-1", inMovementId: "m-2", createdAt: new Date(),
        })).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK", statusCode: 422 });
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

    it("should read the balances of several warehouses with ONE query, locking the rows", async () => {
        executor.query.mockResolvedValueOnce([{ warehouse_id: "BOG", quantity: 35 }]);

        const balances = await repository.getQuantities("p-1", ["BOG", "MED"]);

        expect(executor.query).toHaveBeenCalledTimes(1);
        const { sql, params } = callAt(executor);
        expect(sql).toMatch(/FROM dbo\.stock WITH \(UPDLOCK, HOLDLOCK\)/);
        expect(sql).toMatch(/warehouse_id IN \(@warehouseId0, @warehouseId1\)/);
        expect(params).toEqual({ productId: "p-1", warehouseId0: "BOG", warehouseId1: "MED" });
        expect(balances).toEqual(new Map([["BOG", 35], ["MED", 0]]));
    });

    it("should not query the database when no warehouse is requested", async () => {
        await expect(repository.getQuantities("p-1", [])).resolves.toEqual(new Map());

        expect(executor.query).not.toHaveBeenCalled();
    });

    it("should save the balances of several warehouses with ONE MERGE", async () => {
        await repository.setQuantities("p-1", [
            { warehouseId: "BOG", quantity: 30 },
            { warehouseId: "MED", quantity: 25 },
        ]);

        expect(executor.query).toHaveBeenCalledTimes(1);
        const { sql, params } = callAt(executor);
        expect(sql).toMatch(/MERGE dbo\.stock/);
        expect(sql).toMatch(/VALUES \(@warehouseId0, @productId, @quantity0\), \(@warehouseId1, @productId, @quantity1\)/);
        expect(sql).toMatch(/WHEN MATCHED THEN UPDATE/);
        expect(sql).toMatch(/WHEN NOT MATCHED THEN/);
        expect(params).toEqual({
            productId: "p-1",
            warehouseId0: "BOG",
            quantity0: 30,
            warehouseId1: "MED",
            quantity1: 25,
        });
    });

    it("should not query the database when there are no balances to save", async () => {
        await repository.setQuantities("p-1", []);

        expect(executor.query).not.toHaveBeenCalled();
    });

    it("should read the page and count once, then reuse the cached count", async () => {
        executor.query
            .mockResolvedValueOnce([
            { product_id: "p-1", product_code: "A-1", product_name: "Alfa", quantity: 5, total: 7 },
            { product_id: "p-2", product_code: "B-2", product_name: "Beta", quantity: 0, total: 7 },
            ])
            .mockResolvedValueOnce([{ total: 7 }]);

        const result = await repository.listByWarehouse("BOG", 10, 2);

        expect(executor.query).toHaveBeenCalledTimes(2);
        const { sql, params } = callAt(executor, 0);
        expect(sql).toMatch(/INNER JOIN dbo\.products/);
        expect(sql).not.toMatch(/COUNT\(\*\) OVER \(\)/);
        expect(sql).toMatch(/OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY/);
        expect(params).toEqual({ warehouseId: "BOG", offset: 10, limit: 2 });
        expect(callAt(executor, 1).sql).toMatch(/COUNT\(\*\)/);
        expect(result).toEqual({
            items: [
                { warehouseId: "BOG", productId: "p-1", productCode: "A-1", productName: "Alfa", quantity: 5 },
                { warehouseId: "BOG", productId: "p-2", productCode: "B-2", productName: "Beta", quantity: 0 },
            ],
            total: 7,
        });

        await repository.listByWarehouse("BOG", 0, 2);
        expect(executor.query).toHaveBeenCalledTimes(3);
    });

    it("should return zero for an empty warehouse", async () => {
        await expect(repository.listByWarehouse("CAL", 0, 10)).resolves.toEqual({ items: [], total: 0 });

        expect(executor.query).toHaveBeenCalledTimes(2);
    });

    it("should return the total when the requested page is beyond the end", async () => {
        executor.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 7 }]);

        const result = await repository.listByWarehouse("BOG", 50, 10);

        expect(executor.query).toHaveBeenCalledTimes(2);
        expect(callAt(executor, 1).sql).toMatch(/COUNT\(\*\)/);
        expect(callAt(executor, 1).params).toEqual({ warehouseId: "BOG" });
        expect(result).toEqual({ items: [], total: 7 });
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

    it("should insert several movements with ONE INSERT and return copies", async () => {
        const executor = createExecutorMock();
        const base = {
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
        const movements = [
            { ...base, id: "m-1" },
            { ...base, id: "m-2", type: "TRANSFER_IN" as const, warehouseId: "MED", balanceAfter: 25 },
        ];

        const saved = await new SqlServerMovementRepository(executor).saveMany(movements);

        expect(executor.query).toHaveBeenCalledTimes(1);
        const { sql, params } = callAt(executor);
        expect(sql).toMatch(/INSERT INTO dbo\.movements/);
        expect(sql.match(/\(@id\d/g)).toHaveLength(2);
        expect(params).toMatchObject({
            id0: "m-1",
            type0: "TRANSFER_OUT",
            warehouseId0: "BOG",
            id1: "m-2",
            type1: "TRANSFER_IN",
            warehouseId1: "MED",
            balanceAfter1: 25,
            transferId1: "t-1",
            createdAt1: base.createdAt,
        });
        expect(saved).toEqual(movements);
        expect(saved[0]).not.toBe(movements[0]);
    });

    it("should not query the database when there are no movements", async () => {
        const executor = createExecutorMock();

        await expect(new SqlServerMovementRepository(executor).saveMany([])).resolves.toEqual([]);

        expect(executor.query).not.toHaveBeenCalled();
    });
});
