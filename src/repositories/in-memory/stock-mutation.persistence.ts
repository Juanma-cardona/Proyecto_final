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
import { applyStockAdjustment, applyStockTransfer } from "../shared/stock-mutation.logic";

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
        return applyStockAdjustment(
            mutation,
            (productId) => this.ensureActiveProduct(productId),
            this.stockRepository,
            this.movementRepository
        );
    }

    async transfer(mutation: TransferMutation): Promise<{ originBalance: number; destinationBalance: number }> {
        return applyStockTransfer(
            mutation,
            (productId) => this.ensureActiveProduct(productId),
            this.stockRepository,
            this.movementRepository
        );
    }
}
