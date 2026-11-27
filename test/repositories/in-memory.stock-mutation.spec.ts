import { describe, expect, it } from "vitest";
import { InMemoryStockMutationPersistence } from "../../src/repositories/in-memory/stock-mutation.persistence";
import {
    createMovementRepositoryMock,
    createProductRepositoryMock,
    createStockRepositoryMock,
    makeProduct,
} from "../helpers/mocks";

describe("InMemoryStockMutationPersistence", () => {
    it("adjusts stock and records the adjustment movement", async () => {
        const products = createProductRepositoryMock();
        products.findById.mockResolvedValue(makeProduct());
        const stock = createStockRepositoryMock();
        stock.getQuantity.mockResolvedValue(4);
        const movements = createMovementRepositoryMock();
        const persistence = new InMemoryStockMutationPersistence(products, stock, movements);
        const createdAt = new Date("2026-01-01T00:00:00.000Z");

        await expect(persistence.adjustStock({
            warehouseId: "BOG", productId: "prod-1", quantity: 5, reason: "Initial count", responsibleId: "u-1",
            movementId: "m-1", createdAt,
        })).resolves.toEqual({ previousBalance: 4, newBalance: 9 });
        expect(stock.setQuantity).toHaveBeenCalledWith("BOG", "prod-1", 9);
        expect(movements.save).toHaveBeenCalledWith(expect.objectContaining({
            type: "ADJUSTMENT_IN", quantity: 5, balanceAfter: 9, createdAt,
        }));
    });

    it("transfers stock and records both warehouse movements", async () => {
        const products = createProductRepositoryMock();
        products.findById.mockResolvedValue(makeProduct());
        const stock = createStockRepositoryMock();
        stock.getQuantities.mockResolvedValue(new Map([["BOG", 8], ["MED", 2]]));
        const movements = createMovementRepositoryMock();
        const persistence = new InMemoryStockMutationPersistence(products, stock, movements);

        await expect(persistence.transfer({
            productId: "prod-1", originWarehouseId: "BOG", destinationWarehouseId: "MED", quantity: 3,
            responsibleId: "u-1", transferId: "t-1", outMovementId: "m-out", inMovementId: "m-in",
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
        })).resolves.toEqual({ originBalance: 5, destinationBalance: 5 });
        expect(stock.setQuantities).toHaveBeenCalledWith("prod-1", [
            { warehouseId: "BOG", quantity: 5 }, { warehouseId: "MED", quantity: 5 },
        ]);
        expect(movements.saveMany).toHaveBeenCalledWith([
            expect.objectContaining({ id: "m-out", type: "TRANSFER_OUT", balanceAfter: 5 }),
            expect.objectContaining({ id: "m-in", type: "TRANSFER_IN", balanceAfter: 5 }),
        ]);
    });
});
