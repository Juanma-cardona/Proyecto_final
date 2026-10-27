import { beforeEach, describe, expect, it } from "vitest";
import { TransferRequestDTO } from "../../src/dto/transfer.dto";
import { AppError } from "../../src/exceptions/errors/app.error";
import { TransferService } from "../../src/services/transfer.service";
import {
    createMovementRepositoryMock,
    createProductRepositoryMock,
    createStockRepositoryMock,
    createTransactionManagerMock,
    createWarehouseRepositoryMock,
    expectAppError,
    makeProduct,
    makeWarehouse,
} from "../helpers/mocks";

describe("TransferService", () => {
    let productRepository: ReturnType<typeof createProductRepositoryMock>;
    let warehouseRepository: ReturnType<typeof createWarehouseRepositoryMock>;
    let stockRepository: ReturnType<typeof createStockRepositoryMock>;
    let movementRepository: ReturnType<typeof createMovementRepositoryMock>;
    let service: TransferService;

    const request = (overrides: Partial<TransferRequestDTO> = {}): TransferRequestDTO => ({
        originWarehouseId: "BOG",
        destinationWarehouseId: "MED",
        productId: "prod-1",
        quantity: 20,
        responsibleId: "user-1",
        ...overrides,
    });

    /** Configura los saldos por bodega: { BOG: 50, MED: 5 } */
    const givenStock = (balances: Record<string, number>) => {
        stockRepository.getQuantity.mockImplementation(async (warehouseId: string) => balances[warehouseId] ?? 0);
    };

    beforeEach(() => {
        productRepository = createProductRepositoryMock();
        warehouseRepository = createWarehouseRepositoryMock();
        stockRepository = createStockRepositoryMock();
        movementRepository = createMovementRepositoryMock();
        service = new TransferService(
            productRepository,
            warehouseRepository,
            stockRepository,
            movementRepository,
            createTransactionManagerMock()
        );

        productRepository.findById.mockResolvedValue(makeProduct());
        warehouseRepository.findById.mockImplementation(async (id: string) =>
            ["BOG", "MED", "CAL"].includes(id) ? makeWarehouse({ id }) : null
        );
        givenStock({ BOG: 50, MED: 5 });
    });

    it("should move the stock from origin to destination", async () => {
        const result = await service.transfer(request({ quantity: 20 }));

        expect(stockRepository.setQuantity).toHaveBeenCalledWith("BOG", "prod-1", 30);
        expect(stockRepository.setQuantity).toHaveBeenCalledWith("MED", "prod-1", 25);
        expect(result).toMatchObject({
            productId: "prod-1",
            quantity: 20,
            responsibleId: "user-1",
            origin: { warehouseId: "BOG", newBalance: 30 },
            destination: { warehouseId: "MED", newBalance: 25 },
        });
        expect(result.transferId).toEqual(expect.any(String));
        expect(new Date(result.createdAt).toISOString()).toBe(result.createdAt);
    });

    it("should allow transferring the entire stock of the origin (balance 0)", async () => {
        const result = await service.transfer(request({ quantity: 50 }));

        expect(result.origin.newBalance).toBe(0);
        expect(result.destination.newBalance).toBe(55);
    });

    it("should work when the destination has no previous stock", async () => {
        givenStock({ BOG: 10 });

        const result = await service.transfer(request({ quantity: 4 }));

        expect(result.destination.newBalance).toBe(4);
    });

    it("should register two kardex movements (TRANSFER_OUT and TRANSFER_IN) with the same transferId", async () => {
        const result = await service.transfer(request({ quantity: 20 }));

        expect(movementRepository.save).toHaveBeenCalledTimes(2);
        const [out, inn] = movementRepository.save.mock.calls.map((call) => call[0]);

        expect(out).toMatchObject({
            type: "TRANSFER_OUT",
            warehouseId: "BOG",
            productId: "prod-1",
            quantity: 20,
            balanceAfter: 30,
            reason: null,
            responsibleId: "user-1",
            transferId: result.transferId,
        });
        expect(inn).toMatchObject({
            type: "TRANSFER_IN",
            warehouseId: "MED",
            productId: "prod-1",
            quantity: 20,
            balanceAfter: 25,
            reason: null,
            responsibleId: "user-1",
            transferId: result.transferId,
        });
        expect(out!.id).not.toBe(inn!.id);
    });

    it("should trim the responsible", async () => {
        const result = await service.transfer(request({ responsibleId: "  user-1 " }));

        expect(result.responsibleId).toBe("user-1");
    });

    it.each([
        ["zero", 0],
        ["negative", -3],
        ["a decimal", 2.5],
        ["NaN", Number.NaN],
        ["a string", "5" as unknown as number],
        ["undefined", undefined as unknown as number],
    ])("should throw INVALID_QUANTITY when quantity is %s", async (_label, quantity) => {
        await expectAppError(service.transfer(request({ quantity })), AppError.INVALID_QUANTITY);
        expect(stockRepository.setQuantity).not.toHaveBeenCalled();
    });

    it.each([
        ["undefined", undefined],
        ["empty", ""],
        ["blank", "   "],
    ])("should throw RESPONSIBLE_REQUIRED when responsibleId is %s", async (_label, responsibleId) => {
        await expectAppError(
            service.transfer(request({ responsibleId: responsibleId as unknown as string })),
            AppError.RESPONSIBLE_REQUIRED
        );
        expect(stockRepository.setQuantity).not.toHaveBeenCalled();
    });

    it("should throw SAME_WAREHOUSE when origin and destination are the same", async () => {
        await expectAppError(
            service.transfer(request({ originWarehouseId: "BOG", destinationWarehouseId: "BOG" })),
            AppError.SAME_WAREHOUSE
        );
        expect(stockRepository.setQuantity).not.toHaveBeenCalled();
    });

    it("should throw WAREHOUSE_NOT_FOUND when the origin does not exist", async () => {
        await expectAppError(service.transfer(request({ originWarehouseId: "XXX" })), AppError.WAREHOUSE_NOT_FOUND);
        expect(stockRepository.setQuantity).not.toHaveBeenCalled();
    });

    it("should throw WAREHOUSE_NOT_FOUND when the destination does not exist", async () => {
        await expectAppError(
            service.transfer(request({ destinationWarehouseId: "XXX" })),
            AppError.WAREHOUSE_NOT_FOUND
        );
        expect(stockRepository.setQuantity).not.toHaveBeenCalled();
    });

    it("should throw PRODUCT_NOT_FOUND when the product does not exist", async () => {
        productRepository.findById.mockResolvedValue(null);

        await expectAppError(service.transfer(request()), AppError.PRODUCT_NOT_FOUND);
        expect(stockRepository.setQuantity).not.toHaveBeenCalled();
    });

    it("should throw PRODUCT_INACTIVE when the product is inactive", async () => {
        productRepository.findById.mockResolvedValue(makeProduct({ active: false }));

        await expectAppError(service.transfer(request()), AppError.PRODUCT_INACTIVE);
        expect(stockRepository.setQuantity).not.toHaveBeenCalled();
    });

    it("should throw INSUFFICIENT_STOCK and NOT modify anything when the origin lacks stock", async () => {
        givenStock({ BOG: 5, MED: 0 });

        await expectAppError(service.transfer(request({ quantity: 6 })), AppError.INSUFFICIENT_STOCK);
        expect(stockRepository.setQuantity).not.toHaveBeenCalled();
        expect(movementRepository.save).not.toHaveBeenCalled();
    });

    it("should throw INSUFFICIENT_STOCK when the origin has no record of the product", async () => {
        givenStock({});

        await expectAppError(service.transfer(request({ quantity: 1 })), AppError.INSUFFICIENT_STOCK);
    });
});
