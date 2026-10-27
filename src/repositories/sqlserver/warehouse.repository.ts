import { Warehouse } from "../../entities/warehouse.entities";
import { ISqlExecutor } from "../interfaces/database.interface";
import { IWarehouseRepository } from "../interfaces/repositories.interface";

export class SqlServerWarehouseRepository implements IWarehouseRepository {
    constructor(private readonly sqlExecutor: ISqlExecutor) {}

    async findById(id: string): Promise<Warehouse | null> {
        const rows = await this.sqlExecutor.query<Warehouse>(
            "SELECT id, name, city FROM dbo.warehouses WHERE id = @id",
            { id }
        );
        const row = rows[0];
        return row ? { id: row.id, name: row.name, city: row.city } : null;
    }
}
