import { describe, expect, it } from "vitest";
import { createProductSchema, updateProductStatusSchema } from "../../src/schemas/product.schema";
import { firstInvalidField } from "../helpers/zod";

describe("createProductSchema", () => {
    it("should accept a valid product and trim code and name", () => {
        const data = createProductSchema.parse({ code: "  tor-001 ", name: " Tornillo ", description: "Acero" });

        expect(data).toEqual({ code: "tor-001", name: "Tornillo", description: "Acero" });
    });

    it("should accept a product without description or with a null description", () => {
        expect(firstInvalidField(createProductSchema, { code: "A", name: "B" })).toBeNull();
        expect(firstInvalidField(createProductSchema, { code: "A", name: "B", description: null })).toBeNull();
    });

    it.each([
        ["missing", {}],
        ["empty", { code: "" }],
        ["only spaces", { code: "   " }],
        ["a number", { code: 123 }],
    ])("should reject a code that is %s", (_label, extra) => {
        expect(firstInvalidField(createProductSchema, { name: "Tornillo", ...extra })).toBe("code");
    });

    it.each([
        ["missing", {}],
        ["empty", { name: "" }],
        ["only spaces", { name: "  " }],
        ["a number", { name: 5 }],
    ])("should reject a name that is %s", (_label, extra) => {
        expect(firstInvalidField(createProductSchema, { code: "TOR-001", ...extra })).toBe("name");
    });

    it("should report the code first when code and name are both invalid", () => {
        expect(firstInvalidField(createProductSchema, {})).toBe("code");
    });

    it("should reject a description that is not text", () => {
        expect(firstInvalidField(createProductSchema, { code: "A", name: "B", description: 10 })).toBe("description");
    });

    it.each([[undefined], [null], ["texto"], [[]]])("should reject a body that is not an object (%s)", (body) => {
        expect(createProductSchema.safeParse(body).success).toBe(false);
    });
});

describe("updateProductStatusSchema", () => {
    it.each([[true], [false]])("should accept active = %s", (active) => {
        expect(updateProductStatusSchema.parse({ active })).toEqual({ active });
    });

    it.each([["missing", {}], ["a string", { active: "true" }], ["a number", { active: 1 }], ["null", { active: null }]])(
        "should reject active when it is %s",
        (_label, body) => {
            expect(firstInvalidField(updateProductStatusSchema, body)).toBe("active");
        }
    );
});
