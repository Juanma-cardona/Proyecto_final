import { Movement } from "../../entities/warehouse.entities";
import { AppError } from "../../exceptions/errors/app.error";
import { fail } from "../../exceptions/fail";
import {
    IMovementRepository,
    IStockRepository,
    StockAdjustmentMutation,
    TransferMutation,
} from "../interfaces/repositories.interface";

type EnsureActiveProduct = (productId: string) => Promise<void>;

export const applyStockAdjustment = async (
    mutation: StockAdjustmentMutation,
    ensureActiveProduct: EnsureActiveProduct,
    stockRepository: IStockRepository,
    movementRepository: IMovementRepository
): Promise<{ previousBalance: number; newBalance: number }> => {
    await ensureActiveProduct(mutation.productId);
    const previousBalance = await stockRepository.getQuantity(mutation.warehouseId, mutation.productId);
    const newBalance = previousBalance + mutation.quantity;
    if (newBalance < 0) fail(AppError.INSUFFICIENT_STOCK);

    await stockRepository.setQuantity(mutation.warehouseId, mutation.productId, newBalance);
    const movement: Movement = {
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
    };
    await movementRepository.save(movement);
    return { previousBalance, newBalance };
};

export const applyStockTransfer = async (
    mutation: TransferMutation,
    ensureActiveProduct: EnsureActiveProduct,
    stockRepository: IStockRepository,
    movementRepository: IMovementRepository
): Promise<{ originBalance: number; destinationBalance: number }> => {
    await ensureActiveProduct(mutation.productId);
    const balances = await stockRepository.getQuantities(mutation.productId, [
        mutation.originWarehouseId,
        mutation.destinationWarehouseId,
    ]);
    const currentOrigin = balances.get(mutation.originWarehouseId) ?? 0;
    const currentDestination = balances.get(mutation.destinationWarehouseId) ?? 0;
    if (currentOrigin < mutation.quantity) fail(AppError.INSUFFICIENT_STOCK);

    const originBalance = currentOrigin - mutation.quantity;
    const destinationBalance = currentDestination + mutation.quantity;
    await stockRepository.setQuantities(mutation.productId, [
        { warehouseId: mutation.originWarehouseId, quantity: originBalance },
        { warehouseId: mutation.destinationWarehouseId, quantity: destinationBalance },
    ]);

    const common = {
        productId: mutation.productId,
        quantity: mutation.quantity,
        reason: null,
        transferId: mutation.transferId,
        responsibleId: mutation.responsibleId,
        createdAt: mutation.createdAt,
    };
    const movements: Movement[] = [
        {
            ...common,
            id: mutation.outMovementId,
            type: "TRANSFER_OUT",
            warehouseId: mutation.originWarehouseId,
            balanceAfter: originBalance,
        },
        {
            ...common,
            id: mutation.inMovementId,
            type: "TRANSFER_IN",
            warehouseId: mutation.destinationWarehouseId,
            balanceAfter: destinationBalance,
        },
    ];
    await movementRepository.saveMany(movements);
    return { originBalance, destinationBalance };
};
