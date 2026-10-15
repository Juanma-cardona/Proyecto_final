import { Request, Response } from "express";
import { StockAdjustmentRequestDTO } from "../dto/stock.dto";
import { IStockService } from "../services/interfaces/stock.interface";

export class StockController {
    constructor(readonly stockService: IStockService) {}

    getWarehouseStock = async (req: Request, res: Response): Promise<void> => {
        const warehouseId = req.params.warehouseId as string;
        const page = Number(req.query.page ?? 1);
        const limit = Number(req.query.limit ?? 10);

        const result = await this.stockService.getStockByWarehouse(warehouseId, page, limit);
        res.status(200).json(result);
    };

    createAdjustment = async (req: Request, res: Response): Promise<void> => {
        const request = req.body as StockAdjustmentRequestDTO;
        const result = await this.stockService.adjustStock(request);
        res.status(201).json(result);
    };
}
