import { Request, Response } from "express";
import { TransferRequestDTO } from "../dto/transfer.dto";
import { ITransferService } from "../services/interfaces/transfer.interface";

export class TransferController {
    constructor(readonly transferService: ITransferService) {}

    createTransfer = async (req: Request, res: Response): Promise<void> => {
        const request = req.body as TransferRequestDTO;
        const result = await this.transferService.transfer(request);
        res.status(201).json(result);
    };
}
