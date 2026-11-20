import { Movement } from "../../entities/warehouse.entities";
import { IMovementRepository } from "../interfaces/repositories.interface";

export class InMemoryMovementRepository implements IMovementRepository {
    private readonly movements: Movement[] = [];

    async save(movement: Movement): Promise<Movement> {
        this.movements.push({ ...movement });
        return { ...movement };
    }

    async saveMany(movements: Movement[]): Promise<Movement[]> {
        for (const movement of movements) {
            this.movements.push({ ...movement });
        }
        return movements.map((movement) => ({ ...movement }));
    }
}
