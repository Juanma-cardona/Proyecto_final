import { beforeEach, describe, expect, it } from "vitest";
import { StockAdjustmentRequestDTO } from "../../src/dto/stock.dto";
import { AppError } from "../../src/exceptions/errors/app.error";
import { StockService } from "../../src/services/stock.service";
import {
    createMovementRepositoryMock,
    createProductRepositoryMock,
    createStockRepositoryMock,
    createStockMutationPersistenceMock,
    createWarehouseRepositoryMock,
    expectAppError,
    makeProduct,
    makeWarehouse,
} from "../helpers/mocks";

describe("StockService", () => {
    let productRepository: ReturnType<typeof createProductRepositoryMock>;
    let warehouseRepository: ReturnType<typeof createWarehouseRepositoryMock>;
    let stockRepository: ReturnType<typeof createStockRepositoryMock>;
    let movementRepository: ReturnType<typeof createMovementRepositoryMock>;
    let stockMutationPersistence: ReturnType<typeof createStockMutationPersistenceMock>;
    let service: StockService;

    beforeEach(() => {
        productRepository = createProductRepositoryMock();
        warehouseRepository = createWarehouseRepositoryMock();
        stockRepository = createStockRepositoryMock();
        movementRepository = createMovementRepositoryMock();
        stockMutationPersistence = createStockMutationPersistenceMock(productRepository, stockRepository, movementRepository);
        service = new StockService(
            warehouseRepository,
            stockRepository,
            stockMutationPersistence
        );
    });

    // ------------------------------------------------------------------
    describe("getStockByWarehouse", () => {
        beforeEach(() => {
            warehouseRepository.findById.mockResolvedValue(makeWarehouse());
        });

        it("should return the stock of the warehouse with product info", async () => {
            stockRepository.listByWarehouse.mockResolvedValue({
                items: [
                    {
                        warehouseId: "BOG",
                        productId: "prod-1",
                        productCode: "TOR-001",
                        productName: "Tornillo 1/4",
                        quantity: 30,
                    },
                ],
                total: 1,
            });

            const result = await service.getStockByWarehouse("BOG", 1, 10);

            expect(result).toEqual({
                warehouseId: "BOG",
                warehouseName: "Bodega Bogotá",
                data: [{ productId: "prod-1", productCode: "TOR-001", productName: "Tornillo 1/4", quantity: 30 }],
                page: 1,
                limit: 10,
                total: 1,
                totalPages: 1,
            });
        });

        it("should compute the offset from page and limit", async () => {
            await service.getStockByWarehouse("BOG", 3, 5);

            expect(stockRepository.listByWarehouse).toHaveBeenCalledWith("BOG", 10, 5);
        });

        it("should compute totalPages rounding up", async () => {
            stockRepository.listByWarehouse.mockResolvedValue({ items: [], total: 11 });

            const result = await service.getStockByWarehouse("BOG", 1, 5);

            expect(result.totalPages).toBe(3);
        });

        it("should return an empty page when the warehouse has no stock", async () => {
            const result = await service.getStockByWarehouse("BOG", 1, 10);

            expect(result.data).toEqual([]);
            expect(result.total).toBe(0);
            expect(result.totalPages).toBe(0);
        });

        it("should not query the products one by one (the repository already brings them)", async () => {
            stockRepository.listByWarehouse.mockResolvedValue({
                items: Array.from({ length: 10 }, (_, i) => ({
                    warehouseId: "BOG",
                    productId: `prod-${i}`,
                    productCode: `COD-${i}`,
                    productName: `Producto ${i}`,
                    quantity: i,
                })),
                total: 10,
            });

            const result = await service.getStockByWarehouse("BOG", 1, 10);

            expect(result.data).toHaveLength(10);
            expect(stockRepository.listByWarehouse).toHaveBeenCalledTimes(1);
            expect(productRepository.findById).not.toHaveBeenCalled();
            expect(productRepository.findByIds).not.toHaveBeenCalled();
        });

        it("should keep the order of the stock items and map each one with its own product data", async () => {
            stockRepository.listByWarehouse.mockResolvedValue({
                items: [
                    { warehouseId: "BOG", productId: "prod-2", productCode: "B-2", productName: "Segundo", quantity: 20 },
                    { warehouseId: "BOG", productId: "prod-1", productCode: "A-1", productName: "Primero", quantity: 10 },
                ],
                total: 2,
            });

            const result = await service.getStockByWarehouse("BOG", 1, 10);

            expect(result.data).toEqual([
                { productId: "prod-2", productCode: "B-2", productName: "Segundo", quantity: 20 },
                { productId: "prod-1", productCode: "A-1", productName: "Primero", quantity: 10 },
            ]);
        });

        it("should accept the maximum limit (100) and the first page", async () => {
            await expect(service.getStockByWarehouse("BOG", 1, 100)).resolves.toMatchObject({ limit: 100 });
        });

        it.each([
            ["page is 0", 0, 10],
            ["page is negative", -1, 10],
            ["page is not an integer", 1.5, 10],
            ["page is NaN", Number.NaN, 10],
            ["limit is 0", 1, 0],
            ["limit is negative", 1, -5],
            ["limit is above 100", 1, 101],
            ["limit is not an integer", 1, 2.5],
            ["limit is NaN", 1, Number.NaN],
        ])("should throw INVALID_PAGINATION when %s", async (_label, page, limit) => {
            await expectAppError(service.getStockByWarehouse("BOG", page, limit), AppError.INVALID_PAGINATION);
            expect(stockRepository.listByWarehouse).not.toHaveBeenCalled();
        });

        it("should throw WAREHOUSE_NOT_FOUND (404) when the warehouse does not exist", async () => {
            warehouseRepository.findById.mockResolvedValue(null);

            await expectAppError(service.getStockByWarehouse("XXX", 1, 10), AppError.WAREHOUSE_NOT_FOUND);
            expect(stockRepository.listByWarehouse).not.toHaveBeenCalled();
        });
    });

    // ------------------------------------------------------------------
    describe("adjustStock", () => {
        const request = (overrides: Partial<StockAdjustmentRequestDTO> = {}): StockAdjustmentRequestDTO => ({
            warehouseId: "BOG",
            productId: "prod-1",
            quantity: 10,
            reason: "Carga inicial",
            responsibleId: "user-1",
            ...overrides,
        });

        beforeEach(() => {
            warehouseRepository.findById.mockResolvedValue(makeWarehouse());
            productRepository.findById.mockResolvedValue(makeProduct());
        });

        it("should increase the stock with a positive adjustment (ADJUSTMENT_IN)", async () => {
            stockRepository.getQuantity.mockResolvedValue(5);

            const result = await service.adjustStock(request({ quantity: 10 }));

            expect(stockRepository.setQuantity).toHaveBeenCalledWith("BOG", "prod-1", 15);
            expect(result).toMatchObject({
                warehouseId: "BOG",
                productId: "prod-1",
                type: "ADJUSTMENT_IN",
                quantity: 10,
                previousBalance: 5,
                newBalance: 15,
                reason: "Carga inicial",
                responsibleId: "user-1",
            });
            expect(result.movementId).toEqual(expect.any(String));
        });

        it("should decrease the stock with a negative adjustment (ADJUSTMENT_OUT)", async () => {
            stockRepository.getQuantity.mockResolvedValue(20);

            const result = await service.adjustStock(request({ quantity: -8, reason: "Merma por daño" }));

            expect(stockRepository.setQuantity).toHaveBeenCalledWith("BOG", "prod-1", 12);
            expect(result).toMatchObject({ type: "ADJUSTMENT_OUT", quantity: 8, previousBalance: 20, newBalance: 12 });
        });

        it("should allow leaving the stock exactly at zero", async () => {
            stockRepository.getQuantity.mockResolvedValue(5);

            const result = await service.adjustStock(request({ quantity: -5 }));

            expect(result.newBalance).toBe(0);
            expect(stockRepository.setQuantity).toHaveBeenCalledWith("BOG", "prod-1", 0);
        });

        it("should register the movement in the kardex", async () => {
            stockRepository.getQuantity.mockResolvedValue(5);

            await service.adjustStock(request({ quantity: 10 }));

            expect(movementRepository.save).toHaveBeenCalledTimes(1);
            expect(movementRepository.save).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: "ADJUSTMENT_IN",
                    warehouseId: "BOG",
                    productId: "prod-1",
                    quantity: 10,
                    balanceAfter: 15,
                    reason: "Carga inicial",
                    transferId: null,
                    responsibleId: "user-1",
                    createdAt: expect.any(Date),
                })
            );
        });

        it("should trim the reason and the responsible", async () => {
            const result = await service.adjustStock(request({ reason: "  Conteo físico  ", responsibleId: " user-1 " }));

            expect(result.reason).toBe("Conteo físico");
            expect(result.responsibleId).toBe("user-1");
        });

        it("should accept a reason of exactly 5 characters", async () => {
            await expect(service.adjustStock(request({ reason: "12345" }))).resolves.toBeDefined();
        });

        it.each([
            ["zero", 0],
            ["a decimal", 1.5],
            ["NaN", Number.NaN],
            ["a string", "10" as unknown as number],
            ["undefined", undefined as unknown as number],
        ])("should throw INVALID_QUANTITY when quantity is %s", async (_label, quantity) => {
            await expectAppError(service.adjustStock(request({ quantity })), AppError.INVALID_QUANTITY);
            expect(stockRepository.setQuantity).not.toHaveBeenCalled();
        });

        it.each([
            ["undefined", undefined],
            ["empty", ""],
            ["blank", "     "],
            ["shorter than 5 characters", "abcd"],
        ])("should throw REASON_REQUIRED when reason is %s", async (_label, reason) => {
            await expectAppError(
                service.adjustStock(request({ reason: reason as unknown as string })),
                AppError.REASON_REQUIRED
            );
            expect(stockRepository.setQuantity).not.toHaveBeenCalled();
        });

        it.each([
            ["undefined", undefined],
            ["empty", ""],
            ["blank", "   "],
        ])("should throw RESPONSIBLE_REQUIRED when responsibleId is %s", async (_label, responsibleId) => {
            await expectAppError(
                service.adjustStock(request({ responsibleId: responsibleId as unknown as string })),
                AppError.RESPONSIBLE_REQUIRED
            );
            expect(stockRepository.setQuantity).not.toHaveBeenCalled();
        });

        it("should throw WAREHOUSE_NOT_FOUND (404) when the warehouse does not exist", async () => {
            warehouseRepository.findById.mockResolvedValue(null);

            await expectAppError(service.adjustStock(request()), AppError.WAREHOUSE_NOT_FOUND);
            expect(stockRepository.setQuantity).not.toHaveBeenCalled();
        });

        it("should throw PRODUCT_NOT_FOUND (404) when the product does not exist", async () => {
            productRepository.findById.mockResolvedValue(null);

            await expectAppError(service.adjustStock(request()), AppError.PRODUCT_NOT_FOUND);
            expect(stockRepository.setQuantity).not.toHaveBeenCalled();
        });

        it("should throw PRODUCT_INACTIVE (422) when the product is inactive", async () => {
            productRepository.findById.mockResolvedValue(makeProduct({ active: false }));

            await expectAppError(service.adjustStock(request()), AppError.PRODUCT_INACTIVE);
            expect(stockRepository.setQuantity).not.toHaveBeenCalled();
        });

        it("should throw INSUFFICIENT_STOCK (422) and NOT modify anything when stock would be negative", async () => {
            stockRepository.getQuantity.mockResolvedValue(5);

            await expectAppError(service.adjustStock(request({ quantity: -6 })), AppError.INSUFFICIENT_STOCK);
            expect(stockRepository.setQuantity).not.toHaveBeenCalled();
            expect(movementRepository.save).not.toHaveBeenCalled();
        });

        it("should not allow a negative adjustment on a product with no stock", async () => {
            stockRepository.getQuantity.mockResolvedValue(0);

            await expectAppError(service.adjustStock(request({ quantity: -1 })), AppError.INSUFFICIENT_STOCK);
        });
    });
});
