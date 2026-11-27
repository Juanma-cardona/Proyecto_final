import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../src/exceptions/errors/app.error";
import { ISqlExecutor } from "../../src/repositories/interfaces/database.interface";
import { PostgresMovementRepository } from "../../src/repositories/postgres/movement.repository";
import { PostgresProductRepository } from "../../src/repositories/postgres/product.repository";
import { PostgresStockMutationPersistence } from "../../src/repositories/postgres/stock-mutation.persistence";
import { PostgresStockRepository } from "../../src/repositories/postgres/stock.repository";
import { PostgresWarehouseRepository } from "../../src/repositories/postgres/warehouse.repository";
import {
    createMovementRepositoryMock,
    createStockRepositoryMock,
    createTransactionManagerMock,
    makeProduct,
} from "../helpers/mocks";

const makeExecutor = () => {
    const query = vi.fn(async (_sql: string, _params?: Record<string, string | number | boolean | Date | null>) => [] as unknown[]);
    return { executor: { query } as unknown as ISqlExecutor, query };
};

const productRow = (overrides: Record<string, unknown> = {}) => ({
    id: "p-1",
    code: "TOR-001",
    name: "Tornillo",
    description: null,
    active: true,
    created_at: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
});

describe("PostgresProductRepository", () => {
    let query: ReturnType<typeof makeExecutor>["query"];
    let repository: PostgresProductRepository;

    beforeEach(() => {
        const setup = makeExecutor();
        query = setup.query;
        repository = new PostgresProductRepository(setup.executor);
    });

    it("inserts or updates a product and returns a copy", async () => {
        const product = makeProduct({ description: "Acero" });

        await expect(repository.save(product)).resolves.toEqual(product);
        expect(query).toHaveBeenCalledWith(expect.stringMatching(/ON CONFLICT \(id\) DO UPDATE/), {
            id: product.id,
            code: product.code,
            name: product.name,
            description: "Acero",
            active: true,
            createdAt: product.createdAt,
        });
        const saved = await repository.save(product);
        expect(saved).not.toBe(product);
    });

    it("maps a duplicate code to the application error and rethrows other database errors", async () => {
        query.mockRejectedValueOnce(Object.assign(new Error("duplicate"), { code: "23505" }));
        await expect(repository.save(makeProduct())).rejects.toMatchObject({ code: AppError.PRODUCT_CODE_DUPLICATED.code });

        const databaseError = new Error("connection lost");
        query.mockRejectedValueOnce(databaseError);
        await expect(repository.save(makeProduct())).rejects.toBe(databaseError);
    });

    it("maps rows when finding by id and returns null when absent", async () => {
        query.mockResolvedValueOnce([productRow()]);
        await expect(repository.findById("p-1")).resolves.toEqual(makeProduct({ id: "p-1", name: "Tornillo" }));
        expect(query).toHaveBeenLastCalledWith(expect.stringMatching(/WHERE id = @id/), { id: "p-1" });
        await expect(repository.findById("missing")).resolves.toBeNull();
    });

    it("updates status and maps the returned row, or returns null for a missing product", async () => {
        query.mockResolvedValueOnce([productRow({ active: false })]);
        await expect(repository.updateStatus("p-1", false)).resolves.toMatchObject({ id: "p-1", active: false });
        expect(query).toHaveBeenLastCalledWith(expect.stringMatching(/UPDATE products[\s\S]*RETURNING/), { id: "p-1", active: false });
        await expect(repository.updateStatus("missing", true)).resolves.toBeNull();
    });

    it("finds unique ids with parameterized SQL and skips an empty list", async () => {
        query.mockResolvedValueOnce([productRow(), productRow({ id: "p-2", code: "B-2" })]);
        await expect(repository.findByIds(["p-1", "p-1", "p-2"])).resolves.toHaveLength(2);
        expect(query).toHaveBeenLastCalledWith(expect.stringMatching(/IN \(@id0, @id1\)/), { id0: "p-1", id1: "p-2" });
        const calls = query.mock.calls.length;
        await expect(repository.findByIds([])).resolves.toEqual([]);
        expect(query).toHaveBeenCalledTimes(calls);
    });

    it("finds a product by code and returns null when absent", async () => {
        query.mockResolvedValueOnce([productRow()]);
        await expect(repository.findByCode("TOR-001")).resolves.toMatchObject({ code: "TOR-001" });
        expect(query).toHaveBeenLastCalledWith(expect.stringMatching(/WHERE code = @code/), { code: "TOR-001" });
        await expect(repository.findByCode("missing")).resolves.toBeNull();
    });
});

describe("PostgresWarehouseRepository", () => {
    it("returns a warehouse copy or null when it does not exist", async () => {
        const { executor, query } = makeExecutor();
        const repository = new PostgresWarehouseRepository(executor);
        const warehouse = { id: "BOG", name: "Bodega Bogotá", city: "Bogotá" };
        query.mockResolvedValueOnce([warehouse]);
        const found = await repository.findById("BOG");
        expect(found).toEqual(warehouse);
        expect(found).not.toBe(warehouse);
        expect(query).toHaveBeenLastCalledWith(expect.stringMatching(/FROM warehouses WHERE id = @id/), { id: "BOG" });
        await expect(repository.findById("missing")).resolves.toBeNull();
    });
});

describe("PostgresMovementRepository", () => {
    it("saves one movement through saveMany and returns a copy", async () => {
        const { executor, query } = makeExecutor();
        const repository = new PostgresMovementRepository(executor);
        const movement = {
            id: "m-1", type: "ADJUSTMENT_IN" as const, warehouseId: "BOG", productId: "p-1", quantity: 3,
            balanceAfter: 3, reason: "Conteo", transferId: null, responsibleId: "u-1", createdAt: new Date(),
        };
        const result = await repository.save(movement);
        expect(result).toEqual(movement);
        expect(result).not.toBe(movement);
        expect(query).toHaveBeenCalledWith(expect.stringMatching(/INSERT INTO movements/), expect.objectContaining({
            id0: "m-1", type0: "ADJUSTMENT_IN", warehouseId0: "BOG", productId0: "p-1", quantity0: 3,
        }));
    });

    it("saves multiple movements in one insert and does nothing for an empty list", async () => {
        const { executor, query } = makeExecutor();
        const repository = new PostgresMovementRepository(executor);
        const base = {
            type: "TRANSFER_OUT" as const, warehouseId: "BOG", productId: "p-1", quantity: 2,
            balanceAfter: 1, reason: null, transferId: "t-1", responsibleId: "u-1", createdAt: new Date(),
        };
        const movements = [
            { ...base, id: "out" },
            { ...base, id: "in", type: "TRANSFER_IN" as const, warehouseId: "MED", balanceAfter: 2 },
        ];
        const result = await repository.saveMany(movements);
        expect(result).toEqual(movements);
        expect(result[0]).not.toBe(movements[0]);
        expect(query).toHaveBeenCalledTimes(1);
        expect(query).toHaveBeenCalledWith(expect.stringMatching(/\(@id0[\s\S]*\(@id1/), expect.objectContaining({
            id0: "out", id1: "in", type1: "TRANSFER_IN", warehouseId1: "MED",
        }));
        await expect(repository.saveMany([])).resolves.toEqual([]);
        expect(query).toHaveBeenCalledTimes(1);
    });
});

describe("PostgresStockRepository", () => {
    let query: ReturnType<typeof makeExecutor>["query"];
    let executor: ISqlExecutor;
    let repository: PostgresStockRepository;

    beforeEach(() => {
        vi.restoreAllMocks();
        const setup = makeExecutor();
        query = setup.query;
        executor = setup.executor;
        repository = new PostgresStockRepository(executor);
    });

    it("reads a locked quantity and defaults a missing balance to zero", async () => {
        query.mockResolvedValueOnce([{ quantity: 7 }]);
        await expect(repository.getQuantity("BOG", "p-1")).resolves.toBe(7);
        expect(query).toHaveBeenLastCalledWith(expect.stringMatching(/FOR UPDATE/), { warehouseId: "BOG", productId: "p-1" });
        await expect(repository.getQuantity("BOG", "missing")).resolves.toBe(0);
    });

    it("upserts one quantity and invalidates its count cache", async () => {
        const invalidate = vi.spyOn(repository, "invalidateWarehouseCounts");
        await repository.setQuantity("BOG", "p-1", 8);
        expect(query).toHaveBeenCalledWith(expect.stringMatching(/ON CONFLICT \(warehouse_id, product_id\)/), {
            warehouseId: "BOG", productId: "p-1", quantity: 8,
        });
        expect(invalidate).toHaveBeenCalledWith(["BOG"]);
    });

    it("returns zero balances for unrequested rows and avoids a query for no warehouses", async () => {
        query.mockResolvedValueOnce([{ warehouse_id: "BOG", quantity: 9 }]);
        await expect(repository.getQuantities("p-1", ["BOG", "MED"])).resolves.toEqual(new Map([
            ["BOG", 9], ["MED", 0],
        ]));
        expect(query).toHaveBeenLastCalledWith(expect.stringMatching(/ORDER BY warehouse_id FOR UPDATE/), {
            productId: "p-1", warehouseId0: "BOG", warehouseId1: "MED",
        });
        const calls = query.mock.calls.length;
        await expect(repository.getQuantities("p-1", [])).resolves.toEqual(new Map());
        expect(query).toHaveBeenCalledTimes(calls);
    });

    it("upserts several balances at once and skips an empty update", async () => {
        const invalidate = vi.spyOn(repository, "invalidateWarehouseCounts");
        const balances = [{ warehouseId: "BOG", quantity: 4 }, { warehouseId: "MED", quantity: 6 }];
        await repository.setQuantities("p-1", balances);
        expect(query).toHaveBeenCalledWith(expect.stringMatching(/VALUES \(@warehouseId0, @productId, @quantity0\), \(@warehouseId1/), {
            productId: "p-1", warehouseId0: "BOG", quantity0: 4, warehouseId1: "MED", quantity1: 6,
        });
        expect(invalidate).toHaveBeenCalledWith(["BOG", "MED"]);
        await repository.setQuantities("p-1", []);
        expect(query).toHaveBeenCalledTimes(1);
    });

    it("lists a page, maps rows, and caches the count query", async () => {
        query.mockResolvedValueOnce([{ product_id: "p-1", product_code: "A-1", product_name: "Alfa", quantity: 5 }])
            .mockResolvedValueOnce([{ total: 2 }]);
        await expect(repository.listByWarehouse("BOG", 10, 1)).resolves.toEqual({
            items: [{ warehouseId: "BOG", productId: "p-1", productCode: "A-1", productName: "Alfa", quantity: 5 }],
            total: 2,
        });
        expect(query).toHaveBeenCalledTimes(2);
        expect(query).toHaveBeenCalledWith(expect.stringMatching(/INNER JOIN products/), { warehouseId: "BOG", offset: 10, limit: 1 });
        query.mockResolvedValueOnce([]);
        await repository.listByWarehouse("BOG", 0, 10);
        expect(query).toHaveBeenCalledTimes(3);
    });

    it("coalesces count requests and does not cache a result invalidated while pending", async () => {
        let resolveCount!: (rows: { total: number }[]) => void;
        query.mockResolvedValueOnce([]);
        query.mockImplementationOnce(() => new Promise((resolve) => { resolveCount = resolve; }));
        query.mockResolvedValueOnce([]);
        const first = repository.listByWarehouse("BOG", 0, 10);
        const second = repository.listByWarehouse("BOG", 10, 10);
        await Promise.resolve();
        expect(query).toHaveBeenCalledTimes(3);
        repository.invalidateWarehouseCounts(["BOG"]);
        resolveCount([{ total: 3 }]);
        await Promise.all([first, second]);

        query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 4 }]);
        await repository.listByWarehouse("BOG", 0, 10);
        expect(query).toHaveBeenCalledTimes(5);
    });

    it("refreshes an expired count and defaults to zero when the count row is absent", async () => {
        let now = 100;
        vi.spyOn(Date, "now").mockImplementation(() => now);
        repository = new PostgresStockRepository(executor);
        query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 2 }]);
        await repository.listByWarehouse("MED", 0, 10);
        now += 2500;
        query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
        await expect(repository.listByWarehouse("MED", 0, 10)).resolves.toMatchObject({ total: 0 });
        expect(query).toHaveBeenCalledTimes(4);
    });
});

describe("PostgresStockMutationPersistence", () => {
    const adjustment = {
        warehouseId: "BOG", productId: "p-1", quantity: 3, reason: "Conteo inicial", responsibleId: "u-1",
        movementId: "m-1", createdAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    const transfer = {
        productId: "p-1", originWarehouseId: "BOG", destinationWarehouseId: "MED", quantity: 2,
        responsibleId: "u-1", transferId: "t-1", outMovementId: "m-out", inMovementId: "m-in",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
    };

    it("adjusts stock atomically, writes the matching movement, and invalidates counts", async () => {
        const { executor, query } = makeExecutor();
        query.mockResolvedValueOnce([{ active: true }]);
        const transactions = createTransactionManagerMock();
        const stock = createStockRepositoryMock();
        stock.getQuantity.mockResolvedValue(5);
        const movements = createMovementRepositoryMock();
        const persistence = new PostgresStockMutationPersistence(executor, transactions, stock, movements);

        await expect(persistence.adjustStock(adjustment)).resolves.toEqual({ previousBalance: 5, newBalance: 8 });
        expect(transactions.run).toHaveBeenCalledTimes(1);
        expect(query).toHaveBeenCalledWith(expect.stringMatching(/FOR UPDATE/), { productId: "p-1" });
        expect(stock.setQuantity).toHaveBeenCalledWith("BOG", "p-1", 8);
        expect(movements.save).toHaveBeenCalledWith(expect.objectContaining({
            type: "ADJUSTMENT_IN", quantity: 3, balanceAfter: 8, transferId: null,
        }));
        expect(stock.invalidateWarehouseCounts).toHaveBeenCalledWith(["BOG"]);
    });

    it("records outgoing adjustments as positive movement amounts", async () => {
        const { executor, query } = makeExecutor();
        query.mockResolvedValueOnce([{ active: true }]);
        const stock = createStockRepositoryMock();
        stock.getQuantity.mockResolvedValue(7);
        const movements = createMovementRepositoryMock();
        const persistence = new PostgresStockMutationPersistence(executor, createTransactionManagerMock(), stock, movements);

        await expect(persistence.adjustStock({ ...adjustment, quantity: -2 })).resolves.toEqual({ previousBalance: 7, newBalance: 5 });
        expect(movements.save).toHaveBeenCalledWith(expect.objectContaining({ type: "ADJUSTMENT_OUT", quantity: 2, balanceAfter: 5 }));
    });

    it("rejects missing or inactive products and prevents negative stock", async () => {
        const { executor, query } = makeExecutor();
        const stock = createStockRepositoryMock();
        const movements = createMovementRepositoryMock();
        const persistence = new PostgresStockMutationPersistence(executor, createTransactionManagerMock(), stock, movements);

        await expect(persistence.adjustStock(adjustment)).rejects.toMatchObject({ code: AppError.PRODUCT_NOT_FOUND.code });
        query.mockResolvedValueOnce([{ active: false }]);
        await expect(persistence.adjustStock(adjustment)).rejects.toMatchObject({ code: AppError.PRODUCT_INACTIVE.code });
        query.mockResolvedValueOnce([{ active: true }]);
        stock.getQuantity.mockResolvedValue(1);
        await expect(persistence.adjustStock({ ...adjustment, quantity: -2 })).rejects.toMatchObject({ code: AppError.INSUFFICIENT_STOCK.code });
        expect(stock.setQuantity).not.toHaveBeenCalled();
        expect(movements.save).not.toHaveBeenCalled();
    });

    it("transfers both balances in one transaction and writes paired movements", async () => {
        const { executor, query } = makeExecutor();
        query.mockResolvedValueOnce([{ active: true }]);
        const transactions = createTransactionManagerMock();
        const stock = createStockRepositoryMock();
        stock.getQuantities.mockResolvedValue(new Map([["BOG", 8], ["MED", 1]]));
        const movements = createMovementRepositoryMock();
        const persistence = new PostgresStockMutationPersistence(executor, transactions, stock, movements);

        await expect(persistence.transfer(transfer)).resolves.toEqual({ originBalance: 6, destinationBalance: 3 });
        expect(transactions.run).toHaveBeenCalledTimes(1);
        expect(stock.setQuantities).toHaveBeenCalledWith("p-1", [
            { warehouseId: "BOG", quantity: 6 }, { warehouseId: "MED", quantity: 3 },
        ]);
        expect(movements.saveMany).toHaveBeenCalledWith([
            expect.objectContaining({ id: "m-out", type: "TRANSFER_OUT", warehouseId: "BOG", balanceAfter: 6 }),
            expect.objectContaining({ id: "m-in", type: "TRANSFER_IN", warehouseId: "MED", balanceAfter: 3 }),
        ]);
        expect(stock.invalidateWarehouseCounts).toHaveBeenCalledWith(["BOG", "MED"]);
    });

    it("rejects transfers of inactive products or insufficient stock", async () => {
        const { executor, query } = makeExecutor();
        const stock = createStockRepositoryMock();
        const movements = createMovementRepositoryMock();
        const persistence = new PostgresStockMutationPersistence(executor, createTransactionManagerMock(), stock, movements);

        query.mockResolvedValueOnce([{ active: false }]);
        await expect(persistence.transfer(transfer)).rejects.toMatchObject({ code: AppError.PRODUCT_INACTIVE.code });
        query.mockResolvedValueOnce([{ active: true }]);
        stock.getQuantities.mockResolvedValue(new Map([["BOG", 1], ["MED", 4]]));
        await expect(persistence.transfer(transfer)).rejects.toMatchObject({ code: AppError.INSUFFICIENT_STOCK.code });
        expect(stock.setQuantities).not.toHaveBeenCalled();
        expect(movements.saveMany).not.toHaveBeenCalled();
    });
});
