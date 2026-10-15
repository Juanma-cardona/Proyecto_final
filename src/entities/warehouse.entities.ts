export interface Product {
    id: string;
    code: string;
    name: string;
    description: string | null;
    active: boolean;
    createdAt: Date;
}

export interface Warehouse {
    id: string;
    name: string;
    city: string;
}

export interface StockItem {
    warehouseId: string;
    productId: string;
    quantity: number;
}

export type MovementType =
    | "ADJUSTMENT_IN"
    | "ADJUSTMENT_OUT"
    | "TRANSFER_IN"
    | "TRANSFER_OUT";

/** Línea del kardex: cada cambio de stock queda registrado (auditoría). */
export interface Movement {
    id: string;
    type: MovementType;
    warehouseId: string;
    productId: string;
    quantity: number;       // siempre positivo; el sentido lo da `type`
    balanceAfter: number;   // saldo de la bodega después del movimiento
    reason: string | null;
    transferId: string | null;
    responsibleId: string;
    createdAt: Date;
}
