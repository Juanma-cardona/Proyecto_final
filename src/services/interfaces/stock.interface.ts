import {
    StockAdjustmentRequestDTO,
    StockAdjustmentResponseDTO,
    WarehouseStockResponseDTO,
} from "../../dto/stock.dto";

export interface IStockService {
    getStockByWarehouse(warehouseId: string, page: number, limit: number): Promise<WarehouseStockResponseDTO>;
    adjustStock(request: StockAdjustmentRequestDTO): Promise<StockAdjustmentResponseDTO>;
}
