import { Warehouse } from "../../entities/warehouse.entities";
import { IWarehouseRepository } from "../interfaces/repositories.interface";

/** Las 3 bodegas del enunciado (ciudades de ejemplo: cámbienlas por las reales). */
const DEFAULT_WAREHOUSES: Warehouse[] = [
    { id: "BOG", name: "Bodega Bogotá", city: "Bogotá" },
    { id: "MED", name: "Bodega Medellín", city: "Medellín" },
    { id: "CAL", name: "Bodega Cali", city: "Cali" },
];

export class InMemoryWarehouseRepository implements IWarehouseRepository {
    private readonly warehouses = new Map<string, Warehouse>(
        DEFAULT_WAREHOUSES.map((w) => [w.id, w])
    );

    async findById(id: string): Promise<Warehouse | null> {
        return this.warehouses.get(id) ?? null;
    }
}
