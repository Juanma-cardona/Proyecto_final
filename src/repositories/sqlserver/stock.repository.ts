import { StockItem } from "../../entities/warehouse.entities";
import { ISqlExecutor } from "../interfaces/database.interface";
import { IStockRepository } from "../interfaces/repositories.interface";

export class SqlServerStockRepository implements IStockRepository {
    constructor(private readonly sqlExecutor: ISqlExecutor) {}

    async getQuantity(warehouseId: string, productId: string): Promise<number> {
        // UPDLOCK + HOLDLOCK: dentro de una transacción bloquea la fila (o el hueco si aún no existe)
        // hasta el commit, para que dos operaciones simultáneas no lean el mismo saldo.
        const rows = await this.sqlExecutor.query<{ quantity: number }>(
            `SELECT quantity FROM dbo.stock WITH (UPDLOCK, HOLDLOCK)
             WHERE warehouse_id = @warehouseId AND product_id = @productId`,
            { warehouseId, productId }
        );
        return rows[0]?.quantity ?? 0;
    }

    async setQuantity(warehouseId: string, productId: string, quantity: number): Promise<void> {
        await this.sqlExecutor.query(
            `MERGE dbo.stock WITH (HOLDLOCK) AS target
             USING (SELECT @warehouseId AS warehouse_id, @productId AS product_id) AS source
                ON target.warehouse_id = source.warehouse_id AND target.product_id = source.product_id
             WHEN MATCHED THEN UPDATE SET quantity = @quantity
             WHEN NOT MATCHED THEN
                 INSERT (warehouse_id, product_id, quantity) VALUES (@warehouseId, @productId, @quantity);`,
            { warehouseId, productId, quantity }
        );
    }

    async listByWarehouse(
        warehouseId: string,
        offset: number,
        limit: number
    ): Promise<{ items: StockItem[]; total: number }> {
        const rows = await this.sqlExecutor.query<{ product_id: string; quantity: number }>(
            `SELECT product_id, quantity FROM dbo.stock
             WHERE warehouse_id = @warehouseId
             ORDER BY product_id
             OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
            { warehouseId, offset, limit }
        );
        const count = await this.sqlExecutor.query<{ total: number }>(
            "SELECT COUNT(*) AS total FROM dbo.stock WHERE warehouse_id = @warehouseId",
            { warehouseId }
        );

        return {
            items: rows.map((row) => ({ warehouseId, productId: row.product_id, quantity: row.quantity })),
            total: count[0]?.total ?? 0,
        };
    }
}
