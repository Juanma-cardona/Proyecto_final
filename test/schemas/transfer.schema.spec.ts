import { describe, expect, it } from "vitest";
import { transferSchema } from "../../src/schemas/transfer.schema";
import { firstInvalidField } from "../helpers/zod";

describe("transferSchema", () => {
    const valid = {
        originWarehouseId: "BOG",
        destinationWarehouseId: "MED",
        productId: "p-1",
        quantity: 20,
        responsibleId: "u-1",
    };

    it("should accept a valid transfer", () => {
        expect(firstInvalidField(transferSchema, valid)).toBeNull();
    });

    it.each([["zero", 0], ["negative", -40], ["a decimal", 2.5], ["a string", "10"], ["null", null]])(
        "should reject a quantity that is %s",
        (_label, quantity) => {
            expect(firstInvalidField(transferSchema, { ...valid, quantity })).toBe("quantity");
        }
    );

    it("should accept the minimum quantity 1", () => {
        expect(firstInvalidField(transferSchema, { ...valid, quantity: 1 })).toBeNull();
    });

    it("should reject a missing quantity", () => {
        const { quantity: _quantity, ...withoutQuantity } = valid;

        expect(firstInvalidField(transferSchema, withoutQuantity)).toBe("quantity");
    });

    it.each([[""], ["   "], [undefined]])("should reject the responsibleId %j", (responsibleId) => {
        expect(firstInvalidField(transferSchema, { ...valid, responsibleId })).toBe("responsibleId");
    });

    it("should reject missing warehouses or product", () => {
        expect(firstInvalidField(transferSchema, { ...valid, originWarehouseId: undefined })).toBe("originWarehouseId");
        expect(firstInvalidField(transferSchema, { ...valid, destinationWarehouseId: "" })).toBe("destinationWarehouseId");
        expect(firstInvalidField(transferSchema, { ...valid, productId: undefined })).toBe("productId");
    });

    it("should report the quantity first when several fields are invalid", () => {
        expect(firstInvalidField(transferSchema, {})).toBe("quantity");
    });

    it("should leave the same-warehouse rule to the service", () => {
        expect(firstInvalidField(transferSchema, { ...valid, destinationWarehouseId: "BOG" })).toBeNull();
    });
});
