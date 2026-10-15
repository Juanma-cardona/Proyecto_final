import { randomUUID } from "node:crypto";
import {
    StockAdjustmentRequestDTO,
    StockAdjustmentResponseDTO,
    StockItemResponseDTO,
    WarehouseStockResponseDTO,
} from "../dto/stock.dto";
import { Movement } from "../entities/warehouse.entities";
import { fail } from "../exceptions/fail";
import { AppError } from "../exceptions/errors/app.error";
import {
    IMovementRepository,
    IProductRepository,
    IStockRepository,
    IWarehouseRepository,
} from "../repositories/interfaces/repositories.interface";
import { IStockService } from "./interfaces/stock.interface";

const MIN_REASON_LENGTH = 5;
const MAX_LIMIT = 100;

export class StockService implements IStockService {
    constructor(
        private readonly productRepository: IProductRepository,
        private readonly warehouseRepository: IWarehouseRepository,
        private readonly stockRepository: IStockRepository,
        private readonly movementRepository: IMovementRepository
    ) {}

    async getStockByWarehouse(
        warehouseId: string,
        page: number,
        limit: number
    ): Promise<WarehouseStockResponseDTO> {
        if (!Number.isInteger(page) || !Number.isInteger(limit) || page < 1 || limit < 1 || limit > MAX_LIMIT) {
            fail(AppError.INVALID_PAGINATION);
        }

        const warehouse = await this.warehouseRepository.findById(warehouseId);
        if (!warehouse) fail(AppError.WAREHOUSE_NOT_FOUND);

        const { items, total } = await this.stockRepository.listByWarehouse(
            warehouseId,
            (page - 1) * limit,
            limit
        );

        const data: StockItemResponseDTO[] = [];
        for (const item of items) {
            const product = await this.productRepository.findById(item.productId);
            data.push({
                productId: item.productId,
                productCode: product?.code ?? "UNKNOWN",
                productName: product?.name ?? "UNKNOWN",
                quantity: item.quantity,
            });
        }

        return {
            warehouseId,
            warehouseName: warehouse.name,
            data,
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        };
    }

    async adjustStock(request: StockAdjustmentRequestDTO): Promise<StockAdjustmentResponseDTO> {
        const { warehouseId, productId, quantity } = request;
        const reason = request.reason?.trim();
        const responsibleId = request.responsibleId?.trim();

        if (!Number.isInteger(quantity) || quantity === 0) fail(AppError.INVALID_QUANTITY);
        if (!reason || reason.length < MIN_REASON_LENGTH) fail(AppError.REASON_REQUIRED);
        if (!responsibleId) fail(AppError.RESPONSIBLE_REQUIRED);

        const warehouse = await this.warehouseRepository.findById(warehouseId);
        if (!warehouse) fail(AppError.WAREHOUSE_NOT_FOUND);

        const product = await this.productRepository.findById(productId);
        if (!product) fail(AppError.PRODUCT_NOT_FOUND);
        if (!product.active) fail(AppError.PRODUCT_INACTIVE);

        const previousBalance = await this.stockRepository.getQuantity(warehouseId, productId);
        const newBalance = previousBalance + quantity;
        if (newBalance < 0) fail(AppError.INSUFFICIENT_STOCK);

        await this.stockRepository.setQuantity(warehouseId, productId, newBalance);

        const movement: Movement = {
            id: randomUUID(),
            type: quantity > 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
            warehouseId,
            productId,
            quantity: Math.abs(quantity),
            balanceAfter: newBalance,
            reason: reason,
            transferId: null,
            responsibleId: responsibleId,
            createdAt: new Date(),
        };
        const saved = await this.movementRepository.save(movement);

        return {
            movementId: saved.id,
            warehouseId,
            productId,
            type: saved.type as "ADJUSTMENT_IN" | "ADJUSTMENT_OUT",
            quantity: saved.quantity,
            previousBalance,
            newBalance,
            reason: reason,
            responsibleId: responsibleId,
            createdAt: saved.createdAt.toISOString(),
        };
    }
}
