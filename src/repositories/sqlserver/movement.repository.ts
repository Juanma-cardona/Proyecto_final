import { Movement } from "../../entities/warehouse.entities";
import { ISqlExecutor } from "../interfaces/database.interface";
import { IMovementRepository } from "../interfaces/repositories.interface";

const COLUMNS =
    "id, type, warehouse_id, product_id, quantity, balance_after, reason, transfer_id, responsible_id, created_at";

export class SqlServerMovementRepository implements IMovementRepository {
    constructor(private readonly sqlExecutor: ISqlExecutor) {}

    async save(movement: Movement): Promise<Movement> {
        await this.sqlExecutor.query(
            `INSERT INTO dbo.movements
                 (id, type, warehouse_id, product_id, quantity, balance_after, reason, transfer_id, responsible_id, created_at)
             VALUES
                 (@id, @type, @warehouseId, @productId, @quantity, @balanceAfter, @reason, @transferId, @responsibleId, @createdAt)`,
            {
                id: movement.id,
                type: movement.type,
                warehouseId: movement.warehouseId,
                productId: movement.productId,
                quantity: movement.quantity,
                balanceAfter: movement.balanceAfter,
                reason: movement.reason,
                transferId: movement.transferId,
                responsibleId: movement.responsibleId,
                createdAt: movement.createdAt,
            }
        );
        return { ...movement };
    }

    async saveMany(movements: Movement[]): Promise<Movement[]> {
        if (movements.length === 0) {
            return [];
        }

        // Un solo INSERT con una fila por movimiento (un solo viaje a la base de datos).
        const params: Record<string, string | number | Date | null> = {};
        const rows = movements.map((movement, index) => {
            params[`id${index}`] = movement.id;
            params[`type${index}`] = movement.type;
            params[`warehouseId${index}`] = movement.warehouseId;
            params[`productId${index}`] = movement.productId;
            params[`quantity${index}`] = movement.quantity;
            params[`balanceAfter${index}`] = movement.balanceAfter;
            params[`reason${index}`] = movement.reason;
            params[`transferId${index}`] = movement.transferId;
            params[`responsibleId${index}`] = movement.responsibleId;
            params[`createdAt${index}`] = movement.createdAt;
            return `(@id${index}, @type${index}, @warehouseId${index}, @productId${index}, @quantity${index}, @balanceAfter${index}, @reason${index}, @transferId${index}, @responsibleId${index}, @createdAt${index})`;
        });

        await this.sqlExecutor.query(`INSERT INTO dbo.movements (${COLUMNS}) VALUES ${rows.join(", ")}`, params);
        return movements.map((movement) => ({ ...movement }));
    }
}
