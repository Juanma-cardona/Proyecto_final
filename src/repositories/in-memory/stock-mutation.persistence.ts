import { Movement } from "../../entities/warehouse.entities";
import { AppError } from "../../exceptions/errors/app.error";
import { fail } from "../../exceptions/fail";
import {
    IMovementRepository,
    IProductRepository,
    IStockMutationPersistence,
    IStockRepository,
    StockAdjustmentMutation,
    TransferMutation,
} from "../interfaces/repositories.interface";

export class InMemoryStockMutationPersistence implements IStockMutationPersistence {
    constructor(
        private readonly productRepository: IProductRepository,
        private readonly stockRepository: IStockRepository,
        private readonly movementRepository: IMovementRepository
    ) {}

    private async ensureActiveProduct(productId: string): Promise<void> {
        const product = await this.productRepository.findById(productId);
        if (!product) fail(AppError.PRODUCT_NOT_FOUND);
        if (!product.active) fail(AppError.PRODUCT_INACTIVE);
    }

    async adjustStock(mutation: StockAdjustmentMutation): Promise<{ previousBalance: number; newBalance: number }> {
        await this.ensureActiveProduct(mutation.productId);
        const previousBalance = await this.stockRepository.getQuantity(mutation.warehouseId, mutation.productId);
        const newBalance = previousBalance + mutation.quantity;
        if (newBalance < 0) fail(AppError.INSUFFICIENT_STOCK);

        await this.stockRepository.setQuantity(mutation.warehouseId, mutation.productId, newBalance);
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
        await this.movementRepository.save(movement);
        return { previousBalance, newBalance };
    }

    async transfer(mutation: TransferMutation): Promise<{ originBalance: number; destinationBalance: number }> {
        await this.ensureActiveProduct(mutation.productId);
        const balances = await this.stockRepository.getQuantities(mutation.productId, [
            mutation.originWarehouseId,
            mutation.destinationWarehouseId,
        ]);
        const currentOrigin = balances.get(mutation.originWarehouseId) ?? 0;
        const currentDestination = balances.get(mutation.destinationWarehouseId) ?? 0;
        if (currentOrigin < mutation.quantity) fail(AppError.INSUFFICIENT_STOCK);

        const originBalance = currentOrigin - mutation.quantity;
        const destinationBalance = currentDestination + mutation.quantity;
        await this.stockRepository.setQuantities(mutation.productId, [
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
        const movements: Movement[] = [
            {
                ...base,
                id: mutation.outMovementId,
                type: "TRANSFER_OUT",
                warehouseId: mutation.originWarehouseId,
                balanceAfter: originBalance,
            },
            {
                ...base,
                id: mutation.inMovementId,
                type: "TRANSFER_IN",
                warehouseId: mutation.destinationWarehouseId,
                balanceAfter: destinationBalance,
            },
        ];
        await this.movementRepository.saveMany(movements);
        return { originBalance, destinationBalance };
    }
}
