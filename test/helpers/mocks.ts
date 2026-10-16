import { vi, expect, type Mocked } from "vitest";
import { Movement, Product, Warehouse } from "../../src/entities/warehouse.entities";
import { AppException } from "../../src/exceptions/app.exception";
import {
    IMovementRepository,
    IProductRepository,
    IStockRepository,
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
        findByCode: vi.fn().mockResolvedValue(null),
    }) as unknown as Mocked<IProductRepository>;

export const createWarehouseRepositoryMock = (): Mocked<IWarehouseRepository> =>
    ({
        findById: vi.fn().mockResolvedValue(null),
    }) as unknown as Mocked<IWarehouseRepository>;

export const createStockRepositoryMock = (): Mocked<IStockRepository> =>
    ({
        getQuantity: vi.fn().mockResolvedValue(0),
        setQuantity: vi.fn().mockResolvedValue(undefined),
        listByWarehouse: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    }) as unknown as Mocked<IStockRepository>;

export const createMovementRepositoryMock = (): Mocked<IMovementRepository> =>
    ({
        save: vi.fn().mockImplementation(async (movement: Movement) => movement),
    }) as unknown as Mocked<IMovementRepository>;

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
