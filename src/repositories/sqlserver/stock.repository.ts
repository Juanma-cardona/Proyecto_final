import { StockListItem } from "../../entities/warehouse.entities";
import { WarehouseCountCache } from "../cache/warehouse-count.cache";
import { ISqlExecutor } from "../interfaces/database.interface";
import { IStockRepository, StockBalance } from "../interfaces/repositories.interface";
import { buildStockBalanceValues, buildWarehouseQuery, StockPageRow, toStockListItems } from "../shared/stock.mapping";

export class SqlServerStockRepository implements IStockRepository {
    private readonly warehouseCounts = new WarehouseCountCache();

    constructor(private readonly sqlExecutor: ISqlExecutor) {}

    invalidateWarehouseCounts(warehouseIds: string[]): void {
        this.warehouseCounts.invalidateMany(warehouseIds);
    }

    private getWarehouseCount(warehouseId: string): Promise<number> {
        return this.warehouseCounts.get(warehouseId, async () => {
            const rows = await this.sqlExecutor.query<{ total: number }>(
                "SELECT COUNT(*) AS total FROM dbo.stock WHERE warehouse_id = @warehouseId",
                { warehouseId }
            );
            return rows[0]?.total ?? 0;
        });
    }

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
        this.invalidateWarehouseCounts([warehouseId]);
    }

    async getQuantities(productId: string, warehouseIds: string[]): Promise<Map<string, number>> {
        const { balances, params, placeholders } = buildWarehouseQuery(productId, warehouseIds);
        if (warehouseIds.length === 0) {
            return balances;
        }

        // Una sola consulta con IN (@warehouseId0, @warehouseId1, ...) en lugar de una por bodega.
        // SQL Server recorre la llave (warehouse_id, product_id) en orden, así que las filas se bloquean
        // siempre en el mismo orden y dos transferencias en sentidos opuestos no se bloquean entre sí.
        const rows = await this.sqlExecutor.query<{ warehouse_id: string; quantity: number }>(
            `SELECT warehouse_id, quantity FROM dbo.stock WITH (UPDLOCK, HOLDLOCK)
             WHERE product_id = @productId AND warehouse_id IN (${placeholders.join(", ")})`,
            params
        );
        for (const row of rows) {
            balances.set(row.warehouse_id, row.quantity);
        }
        return balances;
    }

    async setQuantities(productId: string, balances: StockBalance[]): Promise<void> {
        if (balances.length === 0) {
            return;
        }

        // Un solo MERGE con todas las filas (actualiza las que existen e inserta las que no).
        const { params, values } = buildStockBalanceValues(productId, balances);

        await this.sqlExecutor.query(
            `MERGE dbo.stock WITH (HOLDLOCK) AS target
             USING (VALUES ${values.join(", ")}) AS source (warehouse_id, product_id, quantity)
                ON target.warehouse_id = source.warehouse_id AND target.product_id = source.product_id
             WHEN MATCHED THEN UPDATE SET quantity = source.quantity
             WHEN NOT MATCHED THEN
                 INSERT (warehouse_id, product_id, quantity)
                 VALUES (source.warehouse_id, source.product_id, source.quantity);`,
            params
        );
        this.invalidateWarehouseCounts(balances.map((balance) => balance.warehouseId));
    }

    async listByWarehouse(
        warehouseId: string,
        offset: number,
        limit: number
    ): Promise<{ items: StockListItem[]; total: number }> {
        // Devuelve la pagina; el total se reutiliza brevemente y se invalida al modificar stock.
        // INNER JOIN es seguro porque stock.product_id tiene llave foránea hacia products.id.
        const [rows, total] = await Promise.all([
            this.sqlExecutor.query<StockPageRow>(
                `SELECT s.product_id, p.code AS product_code, p.name AS product_name, s.quantity
             FROM dbo.stock AS s
             INNER JOIN dbo.products AS p ON p.id = s.product_id
             WHERE s.warehouse_id = @warehouseId
             ORDER BY s.product_id
             OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
                { warehouseId, offset, limit }
            ),
            this.getWarehouseCount(warehouseId),
        ]);

        return { items: toStockListItems(warehouseId, rows), total };

    }
}
