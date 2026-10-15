import { Movement } from "../../entities/warehouse.entities";
import { IMovementRepository } from "../interfaces/repositories.interface";

export class InMemoryMovementRepository implements IMovementRepository {
    private readonly movements: Movement[] = [];

    async save(movement: Movement): Promise<Movement> {
        this.movements.push({ ...movement });
        return { ...movement };
    }
}
