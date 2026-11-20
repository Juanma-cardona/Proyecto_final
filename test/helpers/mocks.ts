import { vi, expect, type Mocked } from "vitest";
import { Movement, Product, Warehouse } from "../../src/entities/warehouse.entities";
import { AppException } from "../../src/exceptions/app.exception";
import { ITransactionManager } from "../../src/repositories/interfaces/database.interface";
import { AppError } from "../../src/exceptions/errors/app.error";
import {
    IMovementRepository,
    IProductRepository,
    IStockMutationPersistence,
    IStockRepository,
    StockAdjustmentMutation,
    TransferMutation,
    IWarehouseRepository,
} from "../../src/repositories/interfaces/repositories.interface";

// ---------- Fixtures ----------
export const makeProduct = (overrides: Partial<Product> = {}): Product => ({
    id: "prod-1",
    code: "TOR-001",
    name: "Tornillo 1/4",
    description: null,
    active: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
});

export const makeWarehouse = (overrides: Partial<Warehouse> = {}): Warehouse => ({
    id: "BOG",
    name: "Bodega Bogotá",
    city: "Bogotá",
    ...overrides,
});

// ---------- Mocks de repositorios ----------
export const createProductRepositoryMock = (): Mocked<IProductRepository> =>
    ({
        save: vi.fn().mockImplementation(async (product: Product) => product),
        findById: vi.fn().mockResolvedValue(null),
        updateStatus: vi.fn().mockResolvedValue(null),
        findByCode: vi.fn().mockResolvedValue(null),
        findByIds: vi.fn().mockResolvedValue([]),
    }) as unknown as Mocked<IProductRepository>;

export const createWarehouseRepositoryMock = (): Mocked<IWarehouseRepository> =>
    ({
        findById: vi.fn().mockResolvedValue(null),
    }) as unknown as Mocked<IWarehouseRepository>;

export const createStockRepositoryMock = (): Mocked<IStockRepository> =>
    ({
        getQuantity: vi.fn().mockResolvedValue(0),
        setQuantity: vi.fn().mockResolvedValue(undefined),
        getQuantities: vi.fn().mockResolvedValue(new Map()),
        setQuantities: vi.fn().mockResolvedValue(undefined),
        invalidateWarehouseCounts: vi.fn(),
        listByWarehouse: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    }) as unknown as Mocked<IStockRepository>;

export const createMovementRepositoryMock = (): Mocked<IMovementRepository> =>
    ({
        save: vi.fn().mockImplementation(async (movement: Movement) => movement),
        saveMany: vi.fn().mockImplementation(async (movements: Movement[]) => movements),
    }) as unknown as Mocked<IMovementRepository>;

export const createStockMutationPersistenceMock = (
    productRepository: Mocked<IProductRepository>,
    stockRepository: Mocked<IStockRepository>,
    movementRepository: Mocked<IMovementRepository>
): Mocked<IStockMutationPersistence> =>
    ({
        adjustStock: vi.fn(async (mutation: StockAdjustmentMutation) => {
            const product = await productRepository.findById(mutation.productId);
            if (!product) {
                throw new AppException(AppError.PRODUCT_NOT_FOUND.code, AppError.PRODUCT_NOT_FOUND.statusCode, AppError.PRODUCT_NOT_FOUND.message);
            }
            if (!product.active) {
                throw new AppException(AppError.PRODUCT_INACTIVE.code, AppError.PRODUCT_INACTIVE.statusCode, AppError.PRODUCT_INACTIVE.message);
            }
            const previousBalance = await stockRepository.getQuantity(mutation.warehouseId, mutation.productId);
            const newBalance = previousBalance + mutation.quantity;
            if (newBalance < 0) {
                throw new AppException(AppError.INSUFFICIENT_STOCK.code, AppError.INSUFFICIENT_STOCK.statusCode, AppError.INSUFFICIENT_STOCK.message);
            }
            await stockRepository.setQuantity(mutation.warehouseId, mutation.productId, newBalance);
            await movementRepository.save({
                id: mutation.movementId,
                type: mutation.quantity > 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
                warehouseId: mutation.warehouseId,
                productId: mutation.productId,
                quantity: Math.abs(mutation.quantity),
                balanceAfter: newBalance,
                reason: mutation.reason,
                transferId: null,
                responsibleId: mutation.responsibleId,
                createdAt: mutation.createdAt,
            });
            return { previousBalance, newBalance };
        }),
        transfer: vi.fn(async (mutation: TransferMutation) => {
            const product = await productRepository.findById(mutation.productId);
            if (!product) {
                throw new AppException(AppError.PRODUCT_NOT_FOUND.code, AppError.PRODUCT_NOT_FOUND.statusCode, AppError.PRODUCT_NOT_FOUND.message);
            }
            if (!product.active) {
                throw new AppException(AppError.PRODUCT_INACTIVE.code, AppError.PRODUCT_INACTIVE.statusCode, AppError.PRODUCT_INACTIVE.message);
            }
            const balances = await stockRepository.getQuantities(mutation.productId, [
                mutation.originWarehouseId,
                mutation.destinationWarehouseId,
            ]);
            const currentOrigin = balances.get(mutation.originWarehouseId) ?? 0;
            const currentDestination = balances.get(mutation.destinationWarehouseId) ?? 0;
            if (currentOrigin < mutation.quantity) {
                throw new AppException(AppError.INSUFFICIENT_STOCK.code, AppError.INSUFFICIENT_STOCK.statusCode, AppError.INSUFFICIENT_STOCK.message);
            }
            const originBalance = currentOrigin - mutation.quantity;
            const destinationBalance = currentDestination + mutation.quantity;
            await stockRepository.setQuantities(mutation.productId, [
                { warehouseId: mutation.originWarehouseId, quantity: originBalance },
                { warehouseId: mutation.destinationWarehouseId, quantity: destinationBalance },
            ]);
            const base = {
                productId: mutation.productId,
                quantity: mutation.quantity,
                reason: null,
                transferId: mutation.transferId,
                responsibleId: mutation.responsibleId,
                createdAt: mutation.createdAt,
            };
            await movementRepository.saveMany([
                { ...base, id: mutation.outMovementId, type: "TRANSFER_OUT", warehouseId: mutation.originWarehouseId, balanceAfter: originBalance },
                { ...base, id: mutation.inMovementId, type: "TRANSFER_IN", warehouseId: mutation.destinationWarehouseId, balanceAfter: destinationBalance },
            ]);
            return { originBalance, destinationBalance };
        }),
    }) as unknown as Mocked<IStockMutationPersistence>;

/** Transacción de mentira: solo ejecuta el trabajo (los tests de transacciones usan uno que cuenta commits). */
export const createTransactionManagerMock = (): Mocked<ITransactionManager> =>
    ({
        run: vi.fn().mockImplementation(async (work: () => Promise<unknown>) => work()),
    }) as unknown as Mocked<ITransactionManager>;

// ---------- Aserción de errores de negocio ----------
export const expectAppError = async (
    promise: Promise<unknown>,
    error: { code: string; statusCode: number; message: string }
): Promise<void> => {
    await expect(promise).rejects.toBeInstanceOf(AppException);
    await expect(promise).rejects.toMatchObject({
        code: error.code,
        statusCode: error.statusCode,
        message: error.message,
    });
};
