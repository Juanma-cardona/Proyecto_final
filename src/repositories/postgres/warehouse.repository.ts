import { Warehouse } from "../../entities/warehouse.entities";
import { ISqlExecutor } from "../interfaces/database.interface";
import { IWarehouseRepository } from "../interfaces/repositories.interface";

export class PostgresWarehouseRepository implements IWarehouseRepository {
    constructor(private readonly sqlExecutor: ISqlExecutor) {}

    async findById(id: string): Promise<Warehouse | null> {
        const rows = await this.sqlExecutor.query<Warehouse>(
            "SELECT id, name, city FROM warehouses WHERE id = @id",
            { id }
        );
        return rows[0] ? { ...rows[0] } : null;
    }
}
