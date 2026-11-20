import { Warehouse } from "../../entities/warehouse.entities";
import { IWarehouseRepository } from "../interfaces/repositories.interface";

const DEFAULT_TTL_MS = 60_000;

/**
 * Guarda en memoria las bodegas ya consultadas. Son pocas filas que ningún endpoint modifica, así que
 * repetir la consulta en cada petición solo añade un viaje a la base de datos.
 * Solo se guardan las bodegas que existen: si una bodega nueva aparece después, se encuentra enseguida.
 */
export class CachedWarehouseRepository implements IWarehouseRepository {
    private readonly cache = new Map<string, { warehouse: Warehouse; expiresAt: number }>();

    constructor(
        private readonly inner: IWarehouseRepository,
        private readonly ttlMs: number = DEFAULT_TTL_MS,
        private readonly now: () => number = Date.now
    ) {}

    async findById(id: string): Promise<Warehouse | null> {
        const cached = this.cache.get(id);
        if (cached && cached.expiresAt > this.now()) {
            return { ...cached.warehouse };
        }

        const warehouse = await this.inner.findById(id);
        if (warehouse) {
            this.cache.set(id, { warehouse: { ...warehouse }, expiresAt: this.now() + this.ttlMs });
        }
        return warehouse;
    }
}
