export interface StockItemResponseDTO {
    productId: string;
    productCode: string;
    productName: string;
    quantity: number;
}

export interface WarehouseStockResponseDTO {
    warehouseId: string;
    warehouseName: string;
    data: StockItemResponseDTO[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface StockAdjustmentRequestDTO {
    warehouseId: string;
    productId: string;
    /** Delta con signo: positivo suma, negativo resta. No puede ser 0. */
    quantity: number;
    reason: string;
    responsibleId: string;
}

export interface StockAdjustmentResponseDTO {
    movementId: string;
    warehouseId: string;
    productId: string;
    type: "ADJUSTMENT_IN" | "ADJUSTMENT_OUT";
    quantity: number;
    previousBalance: number;
    newBalance: number;
    reason: string;
    responsibleId: string;
    createdAt: string;
}
