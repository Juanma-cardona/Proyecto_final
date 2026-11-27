import { Movement } from "../../entities/warehouse.entities";
import { ISqlExecutor } from "../interfaces/database.interface";
import { IMovementRepository } from "../interfaces/repositories.interface";
import { buildMovementInsertValues, MOVEMENT_COLUMNS } from "../shared/movement.insert";

export class PostgresMovementRepository implements IMovementRepository {
    constructor(private readonly sqlExecutor: ISqlExecutor) {}

    async save(movement: Movement): Promise<Movement> {
        await this.saveMany([movement]);
        return { ...movement };
    }

    async saveMany(movements: Movement[]): Promise<Movement[]> {
        if (movements.length === 0) return [];

        const { params, rows } = buildMovementInsertValues(movements);
        await this.sqlExecutor.query(`INSERT INTO movements (${MOVEMENT_COLUMNS}) VALUES ${rows.join(", ")}`, params);
        return movements.map((movement) => ({ ...movement }));
    }
}
