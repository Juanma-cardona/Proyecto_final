import { Movement } from "../../entities/warehouse.entities";
import { ISqlExecutor } from "../interfaces/database.interface";
import { IMovementRepository } from "../interfaces/repositories.interface";
import { buildMovementInsertValues, MOVEMENT_COLUMNS } from "../shared/movement.insert";

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
        const { params, rows } = buildMovementInsertValues(movements);
        await this.sqlExecutor.query(`INSERT INTO dbo.movements (${MOVEMENT_COLUMNS}) VALUES ${rows.join(", ")}`, params);
        return movements.map((movement) => ({ ...movement }));
    }
}
