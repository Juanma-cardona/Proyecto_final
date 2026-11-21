import { Movement } from "../../entities/warehouse.entities";
import { AppError } from "../../exceptions/errors/app.error";
import { fail } from "../../exceptions/fail";
import { ISqlExecutor, ITransactionManager } from "../interfaces/database.interface";
import {
    IMovementRepository,
    IStockMutationPersistence,
    IStockRepository,
    StockAdjustmentMutation,
    TransferMutation,
} from "../interfaces/repositories.interface";

interface ProductStatusRow {
    active: boolean;
}

export class PostgresStockMutationPersistence implements IStockMutationPersistence {
    constructor(
        private readonly sqlExecutor: ISqlExecutor,
        private readonly transactionManager: ITransactionManager,
        private readonly stockRepository: IStockRepository,
        private readonly movementRepository: IMovementRepository
    ) {}

    private async ensureActiveProduct(productId: string): Promise<void> {
        const rows = await this.sqlExecutor.query<ProductStatusRow>(
            "SELECT active FROM products WHERE id = @productId FOR UPDATE",
            { productId }
        );
        if (!rows[0]) fail(AppError.PRODUCT_NOT_FOUND);
        if (!rows[0].active) fail(AppError.PRODUCT_INACTIVE);
    }

    async adjustStock(mutation: StockAdjustmentMutation): Promise<{ previousBalance: number; newBalance: number }> {
        const result = await this.transactionManager.run(async () => {
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
        });
        this.stockRepository.invalidateWarehouseCounts([mutation.warehouseId]);
        return result;
    }

    async transfer(mutation: TransferMutation): Promise<{ originBalance: number; destinationBalance: number }> {
        const result = await this.transactionManager.run(async () => {
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
            await this.movementRepository.saveMany(movements);
            return { originBalance, destinationBalance };
        });
        this.stockRepository.invalidateWarehouseCounts([
            mutation.originWarehouseId,
            mutation.destinationWarehouseId,
        ]);
        return result;
    }
}
