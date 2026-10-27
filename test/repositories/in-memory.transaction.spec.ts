import { describe, expect, it } from "vitest";
import { InMemoryTransactionManager } from "../../src/repositories/in-memory/transaction.manager";

describe("InMemoryTransactionManager", () => {
    const manager = new InMemoryTransactionManager();

    it("should run the work and return its result", async () => {
        await expect(manager.run(async () => 42)).resolves.toBe(42);
    });

    it("should propagate the error thrown by the work", async () => {
        await expect(
            manager.run(async () => {
                throw new Error("boom");
            })
        ).rejects.toThrow("boom");
    });
});
