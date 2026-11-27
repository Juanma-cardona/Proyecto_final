import { StockListItem } from "../../entities/warehouse.entities";
import { StockBalance } from "../interfaces/repositories.interface";

export interface StockPageRow {
    product_id: string;
    product_code: string;
    product_name: string;
    quantity: number;
}

export const toStockListItems = (warehouseId: string, rows: StockPageRow[]): StockListItem[] =>
    rows.map((row) => ({
        warehouseId,
        productId: row.product_id,
        productCode: row.product_code,
        productName: row.product_name,
        quantity: row.quantity,
    }));

export const buildWarehouseQuery = (productId: string, warehouseIds: string[]) => {
    const balances = new Map<string, number>(warehouseIds.map((id) => [id, 0]));
    const params: Record<string, string> = { productId };
    const placeholders = warehouseIds.map((id, index) => {
        params[`warehouseId${index}`] = id;
        return `@warehouseId${index}`;
    });
    return { balances, params, placeholders };
};

export const buildStockBalanceValues = (productId: string, balances: StockBalance[]) => {
    const params: Record<string, string | number> = { productId };
    const values = balances.map((balance, index) => {
        params[`warehouseId${index}`] = balance.warehouseId;
        params[`quantity${index}`] = balance.quantity;
        return `(@warehouseId${index}, @productId, @quantity${index})`;
    });
    return { params, values };
};
