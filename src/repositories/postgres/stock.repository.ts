import { StockListItem } from "../../entities/warehouse.entities";
import { ISqlExecutor } from "../interfaces/database.interface";
import { IStockRepository, StockBalance } from "../interfaces/repositories.interface";

interface StockPageRow {
    product_id: string;
    product_code: string;
    product_name: string;
    quantity: number;
}

export class PostgresStockRepository implements IStockRepository {
    private static readonly COUNT_CACHE_TTL_MS = 2000;
    private readonly warehouseCounts = new Map<string, { total: number; expiresAt: number; version: number }>();
    private readonly pendingCounts = new Map<string, { version: number; promise: Promise<number> }>();
    private readonly countVersions = new Map<string, number>();

    constructor(private readonly sqlExecutor: ISqlExecutor) {}

    private invalidateWarehouseCount(warehouseId: string): void {
        this.warehouseCounts.delete(warehouseId);
        this.countVersions.set(warehouseId, (this.countVersions.get(warehouseId) ?? 0) + 1);
        this.pendingCounts.delete(warehouseId);
    }

    invalidateWarehouseCounts(warehouseIds: string[]): void {
        for (const warehouseId of warehouseIds) this.invalidateWarehouseCount(warehouseId);
    }

    private getWarehouseCount(warehouseId: string): Promise<number> {
        const version = this.countVersions.get(warehouseId) ?? 0;
        const cached = this.warehouseCounts.get(warehouseId);
        if (cached && cached.expiresAt > Date.now() && cached.version === version) {
            return Promise.resolve(cached.total);
        }
        const pending = this.pendingCounts.get(warehouseId);
        if (pending?.version === version) return pending.promise;

        const promise = this.sqlExecutor
            .query<{ total: number }>(
                "SELECT COUNT(*)::integer AS total FROM stock WHERE warehouse_id = @warehouseId",
                { warehouseId }
            )
            .then((rows) => {
                const total = rows[0]?.total ?? 0;
                if ((this.countVersions.get(warehouseId) ?? 0) === version) {
                    this.warehouseCounts.set(warehouseId, {
                        total,
                        expiresAt: Date.now() + PostgresStockRepository.COUNT_CACHE_TTL_MS,
                        version,
                    });
                }
                return total;
            })
            .finally(() => {
                if (this.pendingCounts.get(warehouseId)?.promise === promise) {
                    this.pendingCounts.delete(warehouseId);
                }
            });
        this.pendingCounts.set(warehouseId, { version, promise });
        return promise;
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
        const balances = new Map<string, number>(warehouseIds.map((id) => [id, 0]));
        if (warehouseIds.length === 0) return balances;

        const params: Record<string, string> = { productId };
        const placeholders = warehouseIds.map((id, index) => {
            params[`warehouseId${index}`] = id;
            return `@warehouseId${index}`;
        });
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

        const params: Record<string, string | number> = { productId };
        const values = balances.map((balance, index) => {
            params[`warehouseId${index}`] = balance.warehouseId;
            params[`quantity${index}`] = balance.quantity;
            return `(@warehouseId${index}, @productId, @quantity${index})`;
        });
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
            items: rows.map((row) => ({
                warehouseId,
                productId: row.product_id,
                productCode: row.product_code,
                productName: row.product_name,
                quantity: row.quantity,
            })),
            total,
        };
    }
}
