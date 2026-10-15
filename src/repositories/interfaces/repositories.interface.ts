import { Movement, Product, StockItem, Warehouse } from "../../entities/warehouse.entities";

export interface IProductRepository {
    save(product: Product): Promise<Product>;
    findById(id: string): Promise<Product | null>;
    findByCode(code: string): Promise<Product | null>;
}

export interface IWarehouseRepository {
    findById(id: string): Promise<Warehouse | null>;
}

export interface IStockRepository {
    /** Devuelve 0 si la bodega aún no tiene registro del producto. */
    getQuantity(warehouseId: string, productId: string): Promise<number>;
    setQuantity(warehouseId: string, productId: string, quantity: number): Promise<void>;
    listByWarehouse(
        warehouseId: string,
        offset: number,
        limit: number
    ): Promise<{ items: StockItem[]; total: number }>;
}

export interface IMovementRepository {
    save(movement: Movement): Promise<Movement>;
}
