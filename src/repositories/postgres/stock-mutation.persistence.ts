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
import { applyStockAdjustment, applyStockTransfer } from "../shared/stock-mutation.logic";

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
        const result = await this.transactionManager.run(() =>
            applyStockAdjustment(
                mutation,
                (productId) => this.ensureActiveProduct(productId),
                this.stockRepository,
                this.movementRepository
            )
        );
        this.stockRepository.invalidateWarehouseCounts([mutation.warehouseId]);
        return result;
    }

    async transfer(mutation: TransferMutation): Promise<{ originBalance: number; destinationBalance: number }> {
        const result = await this.transactionManager.run(() =>
            applyStockTransfer(
                mutation,
                (productId) => this.ensureActiveProduct(productId),
                this.stockRepository,
                this.movementRepository
            )
        );
        this.stockRepository.invalidateWarehouseCounts([
            mutation.originWarehouseId,
            mutation.destinationWarehouseId,
        ]);
        return result;
    }
}
