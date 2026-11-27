import { SqlStockRepository } from "../shared/sql-stock.repository";

export class SqlServerStockRepository extends SqlStockRepository {
    protected countSql(): string {
        return "SELECT COUNT(*) AS total FROM dbo.stock WHERE warehouse_id = @warehouseId";
    }

    protected getQuantitySql(): string {
        return `SELECT quantity FROM dbo.stock WITH (UPDLOCK, HOLDLOCK)
                WHERE warehouse_id = @warehouseId AND product_id = @productId`;
    }

    protected setQuantitySql(): string {
        return `MERGE dbo.stock WITH (HOLDLOCK) AS target
                USING (SELECT @warehouseId AS warehouse_id, @productId AS product_id) AS source
                   ON target.warehouse_id = source.warehouse_id AND target.product_id = source.product_id
                WHEN MATCHED THEN UPDATE SET quantity = @quantity
                WHEN NOT MATCHED THEN
                    INSERT (warehouse_id, product_id, quantity) VALUES (@warehouseId, @productId, @quantity);`;
    }

    protected getQuantitiesSql(placeholders: string): string {
        return `SELECT warehouse_id, quantity FROM dbo.stock WITH (UPDLOCK, HOLDLOCK)
                WHERE product_id = @productId AND warehouse_id IN (${placeholders})`;
    }

    protected setQuantitiesSql(values: string): string {
        return `MERGE dbo.stock WITH (HOLDLOCK) AS target
                USING (VALUES ${values}) AS source (warehouse_id, product_id, quantity)
                   ON target.warehouse_id = source.warehouse_id AND target.product_id = source.product_id
                WHEN MATCHED THEN UPDATE SET quantity = source.quantity
                WHEN NOT MATCHED THEN
                    INSERT (warehouse_id, product_id, quantity)
                    VALUES (source.warehouse_id, source.product_id, source.quantity);`;
    }

    protected listByWarehouseSql(): string {
        return `SELECT s.product_id, p.code AS product_code, p.name AS product_name, s.quantity
                FROM dbo.stock AS s
                INNER JOIN dbo.products AS p ON p.id = s.product_id
                WHERE s.warehouse_id = @warehouseId
                ORDER BY s.product_id
                OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`;
    }
}
