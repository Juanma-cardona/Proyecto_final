import { StockListItem } from "../../entities/warehouse.entities";
import { WarehouseCountCache } from "../cache/warehouse-count.cache";
import { ISqlExecutor } from "../interfaces/database.interface";
import { IStockRepository, StockBalance } from "../interfaces/repositories.interface";
import { buildStockBalanceValues, buildWarehouseQuery, StockPageRow, toStockListItems } from "./stock.mapping";

/** Shared stock repository behavior; subclasses provide only database-specific SQL. */
export abstract class SqlStockRepository implements IStockRepository {
    private readonly warehouseCounts = new WarehouseCountCache();

    constructor(protected readonly sqlExecutor: ISqlExecutor) {}

    protected abstract countSql(): string;
    protected abstract getQuantitySql(): string;
    protected abstract setQuantitySql(): string;
    protected abstract getQuantitiesSql(placeholders: string): string;
    protected abstract setQuantitiesSql(values: string): string;
    protected abstract listByWarehouseSql(): string;

    invalidateWarehouseCounts(warehouseIds: string[]): void {
        this.warehouseCounts.invalidateMany(warehouseIds);
    }

    private getWarehouseCount(warehouseId: string): Promise<number> {
        return this.warehouseCounts.get(warehouseId, async () => {
            const rows = await this.sqlExecutor.query<{ total: number }>(this.countSql(), { warehouseId });
            return rows[0]?.total ?? 0;
        });
    }

    async getQuantity(warehouseId: string, productId: string): Promise<number> {
        const rows = await this.sqlExecutor.query<{ quantity: number }>(this.getQuantitySql(), {
            warehouseId,
            productId,
        });
        return rows[0]?.quantity ?? 0;
    }

    async setQuantity(warehouseId: string, productId: string, quantity: number): Promise<void> {
        await this.sqlExecutor.query(this.setQuantitySql(), { warehouseId, productId, quantity });
        this.invalidateWarehouseCounts([warehouseId]);
    }

    async getQuantities(productId: string, warehouseIds: string[]): Promise<Map<string, number>> {
        const { balances, params, placeholders } = buildWarehouseQuery(productId, warehouseIds);
        if (warehouseIds.length === 0) return balances;

        const rows = await this.sqlExecutor.query<{ warehouse_id: string; quantity: number }>(
            this.getQuantitiesSql(placeholders.join(", ")),
            params
        );
        for (const row of rows) balances.set(row.warehouse_id, row.quantity);
        return balances;
    }

    async setQuantities(productId: string, balances: StockBalance[]): Promise<void> {
        if (balances.length === 0) return;

        const { params, values } = buildStockBalanceValues(productId, balances);
        await this.sqlExecutor.query(this.setQuantitiesSql(values.join(", ")), params);
        this.invalidateWarehouseCounts(balances.map((balance) => balance.warehouseId));
    }

    async listByWarehouse(
        warehouseId: string,
        offset: number,
        limit: number
    ): Promise<{ items: StockListItem[]; total: number }> {
        const [rows, total] = await Promise.all([
            this.sqlExecutor.query<StockPageRow>(this.listByWarehouseSql(), { warehouseId, offset, limit }),
            this.getWarehouseCount(warehouseId),
        ]);
        return { items: toStockListItems(warehouseId, rows), total };
    }
}
