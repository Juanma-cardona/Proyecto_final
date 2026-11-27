import { SqlStockRepository } from "../shared/sql-stock.repository";

export class PostgresStockRepository extends SqlStockRepository {
    protected countSql(): string {
        return "SELECT COUNT(*)::integer AS total FROM stock WHERE warehouse_id = @warehouseId";
    }

    protected getQuantitySql(): string {
        return `SELECT quantity FROM stock
                WHERE warehouse_id = @warehouseId AND product_id = @productId
                FOR UPDATE`;
    }

    protected setQuantitySql(): string {
        return `INSERT INTO stock (warehouse_id, product_id, quantity)
                VALUES (@warehouseId, @productId, @quantity)
                ON CONFLICT (warehouse_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity`;
    }

    protected getQuantitiesSql(placeholders: string): string {
        return `SELECT warehouse_id, quantity FROM stock
                WHERE product_id = @productId AND warehouse_id IN (${placeholders})
                ORDER BY warehouse_id FOR UPDATE`;
    }

    protected setQuantitiesSql(values: string): string {
        return `INSERT INTO stock (warehouse_id, product_id, quantity)
                VALUES ${values}
                ON CONFLICT (warehouse_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity`;
    }

    protected listByWarehouseSql(): string {
        return `SELECT s.product_id, p.code AS product_code, p.name AS product_name, s.quantity
                FROM stock AS s
                INNER JOIN products AS p ON p.id = s.product_id
                WHERE s.warehouse_id = @warehouseId
                ORDER BY s.product_id
                LIMIT @limit OFFSET @offset`;
    }
}
