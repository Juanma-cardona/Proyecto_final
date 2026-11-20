import { randomUUID } from "node:crypto";
import { TransferRequestDTO, TransferResponseDTO } from "../dto/transfer.dto";
import { fail } from "../exceptions/fail";
import { AppError } from "../exceptions/errors/app.error";
import {
    IStockMutationPersistence,
    IWarehouseRepository,
} from "../repositories/interfaces/repositories.interface";
import { ITransferService } from "./interfaces/transfer.interface";

export class TransferService implements ITransferService {
    constructor(
        private readonly warehouseRepository: IWarehouseRepository,
        private readonly stockMutationPersistence: IStockMutationPersistence
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

        const transferId = randomUUID();
        const createdAt = new Date();
        const { originBalance, destinationBalance } = await this.stockMutationPersistence.transfer({
            productId,
            originWarehouseId,
            destinationWarehouseId,
            quantity,
            responsibleId,
            transferId,
            outMovementId: randomUUID(),
            inMovementId: randomUUID(),
            createdAt,
        });

        return {
            transferId,
            productId,
            quantity,
            responsibleId,
            origin: { warehouseId: originWarehouseId, newBalance: originBalance },
            destination: { warehouseId: destinationWarehouseId, newBalance: destinationBalance },
            createdAt: createdAt.toISOString(),
        };
    }
}
