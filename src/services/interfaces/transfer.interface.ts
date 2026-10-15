import { TransferRequestDTO, TransferResponseDTO } from "../../dto/transfer.dto";

export interface ITransferService {
    transfer(request: TransferRequestDTO): Promise<TransferResponseDTO>;
}
