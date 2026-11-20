import { randomUUID } from "node:crypto";
import {
    StockAdjustmentRequestDTO,
    StockAdjustmentResponseDTO,
    StockItemResponseDTO,
    WarehouseStockResponseDTO,
} from "../dto/stock.dto";
import { fail } from "../exceptions/fail";
import { AppError } from "../exceptions/errors/app.error";
import {
    IStockMutationPersistence,
    IStockRepository,
    IWarehouseRepository,
} from "../repositories/interfaces/repositories.interface";
import { IStockService } from "./interfaces/stock.interface";

const MIN_REASON_LENGTH = 5;
const MAX_LIMIT = 100;

export class StockService implements IStockService {
    constructor(
        private readonly warehouseRepository: IWarehouseRepository,
        private readonly stockRepository: IStockRepository,
        private readonly stockMutationPersistence: IStockMutationPersistence
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

        // El repositorio ya trae código y nombre del producto (JOIN): no hay consultas por producto.
        const data: StockItemResponseDTO[] = items.map((item) => ({
            productId: item.productId,
            productCode: item.productCode,
            productName: item.productName,
            quantity: item.quantity,
        }));

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

        const movementId = randomUUID();
        const createdAt = new Date();
        const { previousBalance, newBalance } = await this.stockMutationPersistence.adjustStock({
            warehouseId,
            productId,
            quantity,
            reason,
            responsibleId,
            movementId,
            createdAt,
        });

        return {
            movementId,
            warehouseId,
            productId,
            type: quantity > 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
            quantity: Math.abs(quantity),
            previousBalance,
            newBalance,
            reason,
            responsibleId,
            createdAt: createdAt.toISOString(),
        };
    }
}
