import { describe, expect, it, vi } from "vitest";
import { ISqlExecutor } from "../../src/repositories/interfaces/database.interface";
import { SqlServerStockMutationPersistence } from "../../src/repositories/sqlserver/stock-mutation.persistence";
import { createStockRepositoryMock } from "../helpers/mocks";

const createExecutor = (): ISqlExecutor => ({
    query: vi.fn().mockImplementation(async (sql: string) => {
        if (sql.includes("@previousBalance AS previousBalance")) return [{ previousBalance: 20, newBalance: 25 }];
        return [{ originBalance: 15, destinationBalance: 5 }];
    }),
});

describe("Stock mutation transaction batches", () => {
    it("keeps an adjustment read, update and movement insert in one SQL transaction and request", async () => {
        const executor = createExecutor();
        const persistence = new SqlServerStockMutationPersistence(executor, createStockRepositoryMock());

        await persistence.adjustStock({
            warehouseId: "BOG", productId: "p-1", quantity: 5, reason: "Count", responsibleId: "u-1",
            movementId: "m-1", createdAt: new Date("2026-01-01T00:00:00Z"),
        });

        expect(executor.query).toHaveBeenCalledTimes(1);
        const sql = vi.mocked(executor.query).mock.calls[0]?.[0] as string;
        expect(sql).toMatch(/BEGIN TRANSACTION[\s\S]*UPDLOCK, HOLDLOCK[\s\S]*MERGE dbo\.stock[\s\S]*INSERT INTO dbo\.movements[\s\S]*COMMIT TRANSACTION/);
        expect(sql).toMatch(/BEGIN CATCH[\s\S]*ROLLBACK TRANSACTION/);
    });

    it("keeps a transfer balance lock, update and both movements in one SQL transaction and request", async () => {
        const executor = createExecutor();
        const persistence = new SqlServerStockMutationPersistence(executor, createStockRepositoryMock());

        await persistence.transfer({
            productId: "p-1", originWarehouseId: "BOG", destinationWarehouseId: "MED", quantity: 5,
            responsibleId: "u-1", transferId: "t-1", outMovementId: "m-1", inMovementId: "m-2",
            createdAt: new Date("2026-01-01T00:00:00Z"),
        });

        expect(executor.query).toHaveBeenCalledTimes(1);
        const sql = vi.mocked(executor.query).mock.calls[0]?.[0] as string;
        expect(sql).toMatch(/BEGIN TRANSACTION[\s\S]*UPDLOCK, HOLDLOCK[\s\S]*MERGE dbo\.stock[\s\S]*INSERT INTO dbo\.movements[\s\S]*COMMIT TRANSACTION/);
        expect(sql).toMatch(/BEGIN CATCH[\s\S]*ROLLBACK TRANSACTION/);
    });
});
