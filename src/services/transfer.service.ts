import { randomUUID } from "node:crypto";
import { TransferRequestDTO, TransferResponseDTO } from "../dto/transfer.dto";
import { Movement } from "../entities/warehouse.entities";
import { fail } from "../exceptions/fail";
import { AppError } from "../exceptions/errors/app.error";
import {
    IMovementRepository,
    IProductRepository,
    IStockRepository,
    IWarehouseRepository,
} from "../repositories/interfaces/repositories.interface";
import { ITransferService } from "./interfaces/transfer.interface";

export class TransferService implements ITransferService {
    constructor(
        private readonly productRepository: IProductRepository,
        private readonly warehouseRepository: IWarehouseRepository,
        private readonly stockRepository: IStockRepository,
        private readonly movementRepository: IMovementRepository
    ) {}

    async transfer(request: TransferRequestDTO): Promise<TransferResponseDTO> {
        const { originWarehouseId, destinationWarehouseId, productId, quantity } = request;
        const responsibleId = request.responsibleId?.trim();

        if (!Number.isInteger(quantity) || quantity <= 0) fail(AppError.INVALID_QUANTITY);
        if (!responsibleId) fail(AppError.RESPONSIBLE_REQUIRED);
        if (originWarehouseId === destinationWarehouseId) fail(AppError.SAME_WAREHOUSE);

        const origin = await this.warehouseRepository.findById(originWarehouseId);
        const destination = await this.warehouseRepository.findById(destinationWarehouseId);
        if (!origin || !destination) fail(AppError.WAREHOUSE_NOT_FOUND);

        const product = await this.productRepository.findById(productId);
        if (!product) fail(AppError.PRODUCT_NOT_FOUND);
        if (!product.active) fail(AppError.PRODUCT_INACTIVE);

        const originBalance = await this.stockRepository.getQuantity(originWarehouseId, productId);
        if (originBalance < quantity) fail(AppError.INSUFFICIENT_STOCK);

        const destinationBalance = await this.stockRepository.getQuantity(destinationWarehouseId, productId);
        const newOriginBalance = originBalance - quantity;
        const newDestinationBalance = destinationBalance + quantity;

        // Nota: con una BD real, estas escrituras deben ir en UNA transacción.
        await this.stockRepository.setQuantity(originWarehouseId, productId, newOriginBalance);
        await this.stockRepository.setQuantity(destinationWarehouseId, productId, newDestinationBalance);

        const transferId = randomUUID();
        const createdAt = new Date();
        const base = { productId, quantity, reason: null, transferId, responsibleId: responsibleId, createdAt };

        const outMovement: Movement = {
            ...base,
            id: randomUUID(),
            type: "TRANSFER_OUT",
            warehouseId: originWarehouseId,
            balanceAfter: newOriginBalance,
        };
        const inMovement: Movement = {
            ...base,
            id: randomUUID(),
            type: "TRANSFER_IN",
            warehouseId: destinationWarehouseId,
            balanceAfter: newDestinationBalance,
        };
        await this.movementRepository.save(outMovement);
        await this.movementRepository.save(inMovement);

        return {
            transferId,
            productId,
            quantity,
            responsibleId: responsibleId,
            origin: { warehouseId: originWarehouseId, newBalance: newOriginBalance },
            destination: { warehouseId: destinationWarehouseId, newBalance: newDestinationBalance },
            createdAt: createdAt.toISOString(),
        };
    }
}
