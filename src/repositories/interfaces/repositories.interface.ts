import { Movement, Product, StockListItem, Warehouse } from "../../entities/warehouse.entities";

export interface IProductRepository {
    save(product: Product): Promise<Product>;
    findById(id: string): Promise<Product | null>;
    updateStatus(id: string, active: boolean): Promise<Product | null>;
    findByCode(code: string): Promise<Product | null>;
    /**
     * Busca varios productos en UNA sola consulta (evita consultar uno por uno).
     * Los ids que no existen simplemente no aparecen en el resultado, y el orden no está garantizado.
     */
    findByIds(ids: string[]): Promise<Product[]>;
}

export interface IWarehouseRepository {
    findById(id: string): Promise<Warehouse | null>;
}

/** Saldo de un producto en una bodega. */
export interface StockBalance {
    warehouseId: string;
    quantity: number;
}

export interface IStockRepository {
    /** Devuelve 0 si la bodega aún no tiene registro del producto. */
    getQuantity(warehouseId: string, productId: string): Promise<number>;
    setQuantity(warehouseId: string, productId: string, quantity: number): Promise<void>;
    /**
     * Lee en UNA sola consulta el saldo de un producto en varias bodegas (0 si no hay registro).
     * Dentro de una transacción bloquea esas filas hasta el commit.
     */
    getQuantities(productId: string, warehouseIds: string[]): Promise<Map<string, number>>;
    /** Guarda en UNA sola consulta el saldo de un producto en varias bodegas (inserta o actualiza). */
    setQuantities(productId: string, balances: StockBalance[]): Promise<void>;
    /** Invalida metadatos derivados del conteo de filas en las bodegas indicadas. */
    invalidateWarehouseCounts(warehouseIds: string[]): void;
    /** Una página de stock con código y nombre del producto incluidos, y el total de filas de la bodega. */
    listByWarehouse(
        warehouseId: string,
        offset: number,
        limit: number
    ): Promise<{ items: StockListItem[]; total: number }>;
}

export interface IMovementRepository {
    save(movement: Movement): Promise<Movement>;
    /** Guarda varios movimientos en UNA sola sentencia INSERT. */
    saveMany(movements: Movement[]): Promise<Movement[]>;
}

/** Persiste en una operación el saldo y los dos movimientos de una transferencia. */
export interface StockAdjustmentMutation {
    warehouseId: string;
    productId: string;
    quantity: number;
    reason: string;
    responsibleId: string;
    movementId: string;
    createdAt: Date;
}

export interface TransferMutation {
    productId: string;
    originWarehouseId: string;
    destinationWarehouseId: string;
    quantity: number;
    responsibleId: string;
    transferId: string;
    outMovementId: string;
    inMovementId: string;
    createdAt: Date;
}

export interface IStockMutationPersistence {
    adjustStock(mutation: StockAdjustmentMutation): Promise<{ previousBalance: number; newBalance: number }>;
    transfer(mutation: TransferMutation): Promise<{ originBalance: number; destinationBalance: number }>;
}
