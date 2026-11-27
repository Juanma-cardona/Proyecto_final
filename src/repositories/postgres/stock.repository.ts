import { StockListItem } from "../../entities/warehouse.entities";
import { WarehouseCountCache } from "../cache/warehouse-count.cache";
import { ISqlExecutor } from "../interfaces/database.interface";
import { IStockRepository, StockBalance } from "../interfaces/repositories.interface";
import { buildStockBalanceValues, buildWarehouseQuery, StockPageRow, toStockListItems } from "../shared/stock.mapping";

export class PostgresStockRepository implements IStockRepository {
    private readonly warehouseCounts = new WarehouseCountCache();

    constructor(private readonly sqlExecutor: ISqlExecutor) {}

    invalidateWarehouseCounts(warehouseIds: string[]): void {
        this.warehouseCounts.invalidateMany(warehouseIds);
    }

    private getWarehouseCount(warehouseId: string): Promise<number> {
        return this.warehouseCounts.get(warehouseId, async () => {
            const rows = await this.sqlExecutor.query<{ total: number }>(
                "SELECT COUNT(*)::integer AS total FROM stock WHERE warehouse_id = @warehouseId",
                { warehouseId }
            );
            return rows[0]?.total ?? 0;
        });
    }

    async getQuantity(warehouseId: string, productId: string): Promise<number> {
        const rows = await this.sqlExecutor.query<{ quantity: number }>(
            `SELECT quantity FROM stock
             WHERE warehouse_id = @warehouseId AND product_id = @productId
             FOR UPDATE`,
            { warehouseId, productId }
        );
        return rows[0]?.quantity ?? 0;
    }

    async setQuantity(warehouseId: string, productId: string, quantity: number): Promise<void> {
        await this.sqlExecutor.query(
            `INSERT INTO stock (warehouse_id, product_id, quantity)
             VALUES (@warehouseId, @productId, @quantity)
             ON CONFLICT (warehouse_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity`,
            { warehouseId, productId, quantity }
        );
        this.invalidateWarehouseCounts([warehouseId]);
    }

    async getQuantities(productId: string, warehouseIds: string[]): Promise<Map<string, number>> {
        const { balances, params, placeholders } = buildWarehouseQuery(productId, warehouseIds);
        if (warehouseIds.length === 0) return balances;
        const rows = await this.sqlExecutor.query<{ warehouse_id: string; quantity: number }>(
            `SELECT warehouse_id, quantity FROM stock
             WHERE product_id = @productId AND warehouse_id IN (${placeholders.join(", ")})
             ORDER BY warehouse_id FOR UPDATE`,
            params
        );
        for (const row of rows) balances.set(row.warehouse_id, row.quantity);
        return balances;
    }

    async setQuantities(productId: string, balances: StockBalance[]): Promise<void> {
        if (balances.length === 0) return;
        const { params, values } = buildStockBalanceValues(productId, balances);
        await this.sqlExecutor.query(
            `INSERT INTO stock (warehouse_id, product_id, quantity)
             VALUES ${values.join(", ")}
             ON CONFLICT (warehouse_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity`,
            params
        );
        this.invalidateWarehouseCounts(balances.map((balance) => balance.warehouseId));
    }

    async listByWarehouse(
        warehouseId: string,
        offset: number,
        limit: number
    ): Promise<{ items: StockListItem[]; total: number }> {
        const [rows, total] = await Promise.all([
            this.sqlExecutor.query<StockPageRow>(
                `SELECT s.product_id, p.code AS product_code, p.name AS product_name, s.quantity
                 FROM stock AS s
                 INNER JOIN products AS p ON p.id = s.product_id
                 WHERE s.warehouse_id = @warehouseId
                 ORDER BY s.product_id
                 LIMIT @limit OFFSET @offset`,
                { warehouseId, offset, limit }
            ),
            this.getWarehouseCount(warehouseId),
        ]);
        return {
            items: toStockListItems(warehouseId, rows),
            total,
        };
    }
}
