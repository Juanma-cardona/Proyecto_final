import { AppError } from "../../exceptions/errors/app.error";
import { fail } from "../../exceptions/fail";
import { ISqlExecutor } from "../interfaces/database.interface";
import {
    IStockMutationPersistence,
    IStockRepository,
    StockAdjustmentMutation,
    TransferMutation,
} from "../interfaces/repositories.interface";

const SQL_ERROR = {
    PRODUCT_NOT_FOUND: 51001,
    PRODUCT_INACTIVE: 51002,
    INSUFFICIENT_STOCK: 51003,
} as const;

const translateError = (error: unknown): never => {
    const number = (error as { number?: number })?.number;
    if (number === SQL_ERROR.PRODUCT_NOT_FOUND) fail(AppError.PRODUCT_NOT_FOUND);
    if (number === SQL_ERROR.PRODUCT_INACTIVE) fail(AppError.PRODUCT_INACTIVE);
    if (number === SQL_ERROR.INSUFFICIENT_STOCK) fail(AppError.INSUFFICIENT_STOCK);
    throw error;
};

export class SqlServerStockMutationPersistence implements IStockMutationPersistence {
    constructor(
        private readonly sqlExecutor: ISqlExecutor,
        private readonly stockRepository: IStockRepository
    ) {}

    async adjustStock(mutation: StockAdjustmentMutation): Promise<{ previousBalance: number; newBalance: number }> {
        try {
            const rows = await this.sqlExecutor.query<{ previousBalance: number; newBalance: number }>(
                `SET NOCOUNT ON;
                 SET XACT_ABORT ON;
                 BEGIN TRY
                 BEGIN TRANSACTION;
                 DECLARE @active BIT;
                 DECLARE @previousBalance INT = 0;
                 DECLARE @newBalance INT;

                 SELECT @active = active FROM dbo.products WHERE id = @productId;
                 IF @active IS NULL THROW 51001, 'PRODUCT_NOT_FOUND', 1;
                 IF @active = 0 THROW 51002, 'PRODUCT_INACTIVE', 1;

                 SELECT @previousBalance = quantity
                 FROM dbo.stock WITH (UPDLOCK, HOLDLOCK)
                 WHERE warehouse_id = @warehouseId AND product_id = @productId;

                 SET @newBalance = @previousBalance + @quantity;
                 IF @newBalance < 0 THROW 51003, 'INSUFFICIENT_STOCK', 1;

                 MERGE dbo.stock WITH (HOLDLOCK) AS target
                 USING (SELECT @warehouseId AS warehouse_id, @productId AS product_id) AS source
                    ON target.warehouse_id = source.warehouse_id AND target.product_id = source.product_id
                 WHEN MATCHED THEN UPDATE SET quantity = @newBalance
                 WHEN NOT MATCHED THEN
                     INSERT (warehouse_id, product_id, quantity)
                     VALUES (@warehouseId, @productId, @newBalance);

                 INSERT INTO dbo.movements
                     (id, type, warehouse_id, product_id, quantity, balance_after, reason, transfer_id, responsible_id, created_at)
                 VALUES
                     (@movementId, CASE WHEN @quantity > 0 THEN N'ADJUSTMENT_IN' ELSE N'ADJUSTMENT_OUT' END,
                      @warehouseId, @productId, ABS(@quantity), @newBalance, @reason, NULL, @responsibleId, @createdAt);

                 COMMIT TRANSACTION;
                 SELECT @previousBalance AS previousBalance, @newBalance AS newBalance;
                 END TRY
                 BEGIN CATCH
                     IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
                     THROW;
                 END CATCH;`,
                { ...mutation }
            );
            const result = rows[0];
            if (!result) throw new Error("Stock adjustment did not return its resulting balances");
            this.stockRepository.invalidateWarehouseCounts([mutation.warehouseId]);
            return result;
        } catch (error) {
            return translateError(error);
        }
    }

    async transfer(mutation: TransferMutation): Promise<{ originBalance: number; destinationBalance: number }> {
        const params: Record<string, string | number | Date> = { ...mutation };
        const stockValues = [mutation.originWarehouseId, mutation.destinationWarehouseId].map((warehouseId, index) => {
            params[`warehouseId${index}`] = warehouseId;
            params[`quantity${index}`] = index === 0 ? -mutation.quantity : mutation.quantity;
            return `(@warehouseId${index}, @productId, @quantity${index})`;
        });
        try {
            const rows = await this.sqlExecutor.query<{ originBalance: number; destinationBalance: number }>(
                `SET NOCOUNT ON;
                 SET XACT_ABORT ON;
                 BEGIN TRY
                 BEGIN TRANSACTION;
                 DECLARE @active BIT;
                 DECLARE @currentOrigin INT = 0;
                 DECLARE @currentDestination INT = 0;
                 DECLARE @originBalance INT;
                 DECLARE @destinationBalance INT;

                 SELECT @active = active FROM dbo.products WHERE id = @productId;
                 IF @active IS NULL THROW 51001, 'PRODUCT_NOT_FOUND', 1;
                 IF @active = 0 THROW 51002, 'PRODUCT_INACTIVE', 1;

                 IF @originWarehouseId < @destinationWarehouseId
                 BEGIN
                     SELECT @currentOrigin = quantity FROM dbo.stock WITH (UPDLOCK, HOLDLOCK)
                     WHERE warehouse_id = @originWarehouseId AND product_id = @productId;
                     SELECT @currentDestination = quantity FROM dbo.stock WITH (UPDLOCK, HOLDLOCK)
                     WHERE warehouse_id = @destinationWarehouseId AND product_id = @productId;
                 END
                 ELSE
                 BEGIN
                     SELECT @currentDestination = quantity FROM dbo.stock WITH (UPDLOCK, HOLDLOCK)
                     WHERE warehouse_id = @destinationWarehouseId AND product_id = @productId;
                     SELECT @currentOrigin = quantity FROM dbo.stock WITH (UPDLOCK, HOLDLOCK)
                     WHERE warehouse_id = @originWarehouseId AND product_id = @productId;
                 END;

                 IF @currentOrigin < @quantity THROW 51003, 'INSUFFICIENT_STOCK', 1;
                 SET @originBalance = @currentOrigin - @quantity;
                 SET @destinationBalance = @currentDestination + @quantity;

                 MERGE dbo.stock WITH (HOLDLOCK) AS target
                 USING (VALUES ${stockValues.join(", ")}) AS source (warehouse_id, product_id, quantity)
                    ON target.warehouse_id = source.warehouse_id AND target.product_id = source.product_id
                 WHEN MATCHED THEN UPDATE SET quantity = target.quantity + source.quantity
                 WHEN NOT MATCHED THEN INSERT (warehouse_id, product_id, quantity)
                    VALUES (source.warehouse_id, source.product_id, source.quantity);

                 INSERT INTO dbo.movements
                     (id, type, warehouse_id, product_id, quantity, balance_after, reason, transfer_id, responsible_id, created_at)
                 VALUES
                     (@outMovementId, N'TRANSFER_OUT', @originWarehouseId, @productId, @quantity, @originBalance, NULL, @transferId, @responsibleId, @createdAt),
                     (@inMovementId, N'TRANSFER_IN', @destinationWarehouseId, @productId, @quantity, @destinationBalance, NULL, @transferId, @responsibleId, @createdAt);

                 COMMIT TRANSACTION;
                 SELECT @originBalance AS originBalance, @destinationBalance AS destinationBalance;
                 END TRY
                 BEGIN CATCH
                     IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
                     THROW;
                 END CATCH;`,
                params
            );
            const result = rows[0];
            if (!result) throw new Error("Transfer did not return its resulting balances");
            this.stockRepository.invalidateWarehouseCounts([
                mutation.originWarehouseId,
                mutation.destinationWarehouseId,
            ]);
            return result;
        } catch (error) {
            return translateError(error);
        }
    }
}
