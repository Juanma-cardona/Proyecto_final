import { describe, expect, it } from "vitest";
import { paginationQuerySchema, stockAdjustmentSchema } from "../../src/schemas/stock.schema";
import { firstInvalidField } from "../helpers/zod";

describe("paginationQuerySchema", () => {
    it("should use page 1 and limit 10 when they are not provided", () => {
        expect(paginationQuerySchema.parse({})).toEqual({ page: 1, limit: 10 });
    });

    it("should convert numeric strings coming from the query string", () => {
        expect(paginationQuerySchema.parse({ page: "2", limit: "50" })).toEqual({ page: 2, limit: 50 });
    });

    it("should accept the limit boundaries 1 and 100", () => {
        expect(firstInvalidField(paginationQuerySchema, { limit: "1" })).toBeNull();
        expect(firstInvalidField(paginationQuerySchema, { limit: "100" })).toBeNull();
    });

    it("should reject a limit of 0 or greater than 100", () => {
        expect(firstInvalidField(paginationQuerySchema, { limit: "0" })).toBe("limit");
        expect(firstInvalidField(paginationQuerySchema, { limit: "101" })).toBe("limit");
    });

    it.each([["0"], ["-1"], ["abc"], ["1.5"], [""]])("should reject the page %j", (page) => {
        expect(firstInvalidField(paginationQuerySchema, { page })).toBe("page");
    });

    it("should reject a limit that is not a number", () => {
        expect(firstInvalidField(paginationQuerySchema, { limit: "abc" })).toBe("limit");
    });
});

describe("stockAdjustmentSchema", () => {
    const valid = {
        warehouseId: "BOG",
        productId: "p-1",
        quantity: 10,
        reason: "Conteo físico",
        responsibleId: "u-1",
    };

    it("should accept positive and negative adjustments", () => {
        expect(firstInvalidField(stockAdjustmentSchema, valid)).toBeNull();
        expect(firstInvalidField(stockAdjustmentSchema, { ...valid, quantity: -3 })).toBeNull();
    });

    it("should trim reason and responsibleId", () => {
        const data = stockAdjustmentSchema.parse({ ...valid, reason: "  Conteo  ", responsibleId: " u-1 " });

        expect(data.reason).toBe("Conteo");
        expect(data.responsibleId).toBe("u-1");
    });

    it.each([["zero", 0], ["a decimal", 1.5], ["a string", "5"], ["null", null]])(
        "should reject a quantity that is %s",
        (_label, quantity) => {
            expect(firstInvalidField(stockAdjustmentSchema, { ...valid, quantity })).toBe("quantity");
        }
    );

    it("should reject a missing quantity", () => {
        const { quantity: _quantity, ...withoutQuantity } = valid;

        expect(firstInvalidField(stockAdjustmentSchema, withoutQuantity)).toBe("quantity");
    });

    it("should require a reason of at least 5 characters after trimming", () => {
        expect(firstInvalidField(stockAdjustmentSchema, { ...valid, reason: "abcde" })).toBeNull();
        expect(firstInvalidField(stockAdjustmentSchema, { ...valid, reason: "abcd" })).toBe("reason");
        expect(firstInvalidField(stockAdjustmentSchema, { ...valid, reason: "  abc  " })).toBe("reason");
        expect(firstInvalidField(stockAdjustmentSchema, { ...valid, reason: "     " })).toBe("reason");
    });

    it("should reject a missing reason", () => {
        const { reason: _reason, ...withoutReason } = valid;

        expect(firstInvalidField(stockAdjustmentSchema, withoutReason)).toBe("reason");
    });

    it.each([[""], ["   "], [undefined], [7]])("should reject the responsibleId %j", (responsibleId) => {
        expect(firstInvalidField(stockAdjustmentSchema, { ...valid, responsibleId })).toBe("responsibleId");
    });

    it("should reject missing warehouseId or productId", () => {
        expect(firstInvalidField(stockAdjustmentSchema, { ...valid, warehouseId: undefined })).toBe("warehouseId");
        expect(firstInvalidField(stockAdjustmentSchema, { ...valid, productId: undefined })).toBe("productId");
    });

    it("should report the quantity before the reason when both are invalid", () => {
        expect(firstInvalidField(stockAdjustmentSchema, { ...valid, quantity: 0, reason: "" })).toBe("quantity");
    });
});
