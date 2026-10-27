import { beforeEach, describe, expect, it } from "vitest";
import { ITransactionManager } from "../../src/repositories/interfaces/database.interface";
import { AppError } from "../../src/exceptions/errors/app.error";
import { StockService } from "../../src/services/stock.service";
import { TransferService } from "../../src/services/transfer.service";
import {
    createMovementRepositoryMock,
    createProductRepositoryMock,
    createStockRepositoryMock,
    createWarehouseRepositoryMock,
    expectAppError,
    makeProduct,
    makeWarehouse,
} from "../helpers/mocks";

/** Gestor de transacciones que cuenta commits y rollbacks y sabe si hay una transacción abierta. */
const createRecordingTransactionManager = () => {
    const state = { open: false, commits: 0, rollbacks: 0, runs: 0 };
    const manager: ITransactionManager = {
        run: async (work) => {
            state.runs++;
            state.open = true;
            try {
                const result = await work();
                state.commits++;
                return result;
            } catch (error) {
                state.rollbacks++;
                throw error;
            } finally {
                state.open = false;
            }
        },
    };
    return { manager, state };
};

describe("Atomicity of the stock operations", () => {
    let productRepository: ReturnType<typeof createProductRepositoryMock>;
    let warehouseRepository: ReturnType<typeof createWarehouseRepositoryMock>;
    let stockRepository: ReturnType<typeof createStockRepositoryMock>;
    let movementRepository: ReturnType<typeof createMovementRepositoryMock>;
    let recorder: ReturnType<typeof createRecordingTransactionManager>;
    let openWhenWriting: boolean[];

    beforeEach(() => {
        productRepository = createProductRepositoryMock();
        warehouseRepository = createWarehouseRepositoryMock();
        stockRepository = createStockRepositoryMock();
        movementRepository = createMovementRepositoryMock();
        recorder = createRecordingTransactionManager();
        openWhenWriting = [];

        productRepository.findById.mockResolvedValue(makeProduct());
        warehouseRepository.findById.mockImplementation(async (id: string) => makeWarehouse({ id }));
        stockRepository.getQuantity.mockImplementation(async () => {
            openWhenWriting.push(recorder.state.open);
            return 50;
        });
        stockRepository.setQuantity.mockImplementation(async () => {
            openWhenWriting.push(recorder.state.open);
        });
        movementRepository.save.mockImplementation(async (movement) => {
            openWhenWriting.push(recorder.state.open);
            return movement;
        });
    });

    describe("TransferService", () => {
        let service: TransferService;
        const request = {
            originWarehouseId: "BOG",
            destinationWarehouseId: "MED",
            productId: "prod-1",
            quantity: 20,
            responsibleId: "user-1",
        };

        beforeEach(() => {
            service = new TransferService(
                productRepository,
                warehouseRepository,
                stockRepository,
                movementRepository,
                recorder.manager
            );
        });

        it("should read, write and register the movements inside one transaction that is committed", async () => {
            await service.transfer(request);

            expect(recorder.state).toMatchObject({ runs: 1, commits: 1, rollbacks: 0 });
            // 2 lecturas + 2 escrituras de stock + 2 movimientos
            expect(openWhenWriting).toEqual([true, true, true, true, true, true]);
        });

        it("should roll the transaction back when the origin does not have enough stock", async () => {
            stockRepository.getQuantity.mockResolvedValue(5);

            await expectAppError(service.transfer(request), AppError.INSUFFICIENT_STOCK);

            expect(recorder.state).toMatchObject({ runs: 1, commits: 0, rollbacks: 1 });
            expect(stockRepository.setQuantity).not.toHaveBeenCalled();
        });

        it("should roll the transaction back when saving a movement fails", async () => {
            movementRepository.save.mockRejectedValueOnce(new Error("db down"));

            await expect(service.transfer(request)).rejects.toThrow("db down");

            expect(recorder.state).toMatchObject({ commits: 0, rollbacks: 1 });
        });

        it("should not open a transaction when the request is invalid", async () => {
            await expectAppError(service.transfer({ ...request, quantity: 0 }), AppError.INVALID_QUANTITY);
            await expectAppError(
                service.transfer({ ...request, destinationWarehouseId: "BOG" }),
                AppError.SAME_WAREHOUSE
            );

            expect(recorder.state.runs).toBe(0);
        });

        it("should not open a transaction when the product does not exist", async () => {
            productRepository.findById.mockResolvedValue(null);

            await expectAppError(service.transfer(request), AppError.PRODUCT_NOT_FOUND);

            expect(recorder.state.runs).toBe(0);
        });
    });

    describe("StockService.adjustStock", () => {
        let service: StockService;
        const request = {
            warehouseId: "BOG",
            productId: "prod-1",
            quantity: 10,
            reason: "Conteo físico",
            responsibleId: "user-1",
        };

        beforeEach(() => {
            service = new StockService(
                productRepository,
                warehouseRepository,
                stockRepository,
                movementRepository,
                recorder.manager
            );
        });

        it("should read, write and register the movement inside one transaction that is committed", async () => {
            await service.adjustStock(request);

            expect(recorder.state).toMatchObject({ runs: 1, commits: 1, rollbacks: 0 });
            // 1 lectura + 1 escritura de stock + 1 movimiento
            expect(openWhenWriting).toEqual([true, true, true]);
        });

        it("should roll the transaction back when the adjustment would leave negative stock", async () => {
            await expectAppError(service.adjustStock({ ...request, quantity: -51 }), AppError.INSUFFICIENT_STOCK);

            expect(recorder.state).toMatchObject({ runs: 1, commits: 0, rollbacks: 1 });
            expect(stockRepository.setQuantity).not.toHaveBeenCalled();
        });

        it("should roll the transaction back when saving the movement fails", async () => {
            movementRepository.save.mockRejectedValueOnce(new Error("db down"));

            await expect(service.adjustStock(request)).rejects.toThrow("db down");

            expect(recorder.state).toMatchObject({ commits: 0, rollbacks: 1 });
        });

        it("should not open a transaction when the request is invalid", async () => {
            await expectAppError(service.adjustStock({ ...request, quantity: 0 }), AppError.INVALID_QUANTITY);

            expect(recorder.state.runs).toBe(0);
        });
    });
});
