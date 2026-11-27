interface CachedCount {
    total: number;
    expiresAt: number;
    version: number;
}

interface PendingCount {
    version: number;
    promise: Promise<number>;
}

/** Shares short-lived warehouse row counts and coalesces concurrent reads. */
export class WarehouseCountCache {
    private readonly values = new Map<string, CachedCount>();
    private readonly pending = new Map<string, PendingCount>();
    private readonly versions = new Map<string, number>();

    constructor(private readonly ttlMs = 2000, private readonly now: () => number = Date.now) {}

    invalidate(warehouseId: string): void {
        this.values.delete(warehouseId);
        this.versions.set(warehouseId, (this.versions.get(warehouseId) ?? 0) + 1);
        this.pending.delete(warehouseId);
    }

    invalidateMany(warehouseIds: string[]): void {
        for (const warehouseId of warehouseIds) this.invalidate(warehouseId);
    }

    get(warehouseId: string, load: () => Promise<number>): Promise<number> {
        const version = this.versions.get(warehouseId) ?? 0;
        const cached = this.values.get(warehouseId);
        if (cached && cached.expiresAt > this.now() && cached.version === version) {
            return Promise.resolve(cached.total);
        }

        const existing = this.pending.get(warehouseId);
        if (existing?.version === version) return existing.promise;

        const promise = load()
            .then((total) => {
                if ((this.versions.get(warehouseId) ?? 0) === version) {
                    this.values.set(warehouseId, { total, expiresAt: this.now() + this.ttlMs, version });
                }
                return total;
            })
            .finally(() => {
                if (this.pending.get(warehouseId)?.promise === promise) this.pending.delete(warehouseId);
            });
        this.pending.set(warehouseId, { version, promise });
        return promise;
    }
}
