import { Movement } from "../../entities/warehouse.entities";
import { ISqlExecutor } from "../interfaces/database.interface";
import { IMovementRepository } from "../interfaces/repositories.interface";

const COLUMNS =
    "id, type, warehouse_id, product_id, quantity, balance_after, reason, transfer_id, responsible_id, created_at";

export class PostgresMovementRepository implements IMovementRepository {
    constructor(private readonly sqlExecutor: ISqlExecutor) {}

    async save(movement: Movement): Promise<Movement> {
        await this.saveMany([movement]);
        return { ...movement };
    }

    async saveMany(movements: Movement[]): Promise<Movement[]> {
        if (movements.length === 0) return [];

        const params: Record<string, string | number | Date | null> = {};
        const values = movements.map((movement, index) => {
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

        await this.sqlExecutor.query(`INSERT INTO movements (${COLUMNS}) VALUES ${values.join(", ")}`, params);
        return movements.map((movement) => ({ ...movement }));
    }
}
