export interface TransferRequestDTO {
    originWarehouseId: string;
    destinationWarehouseId: string;
    productId: string;
    quantity: number;
    responsibleId: string;
}

export interface TransferResponseDTO {
    transferId: string;
    productId: string;
    quantity: number;
    responsibleId: string;
    origin: { warehouseId: string; newBalance: number };
    destination: { warehouseId: string; newBalance: number };
    createdAt: string;
}
