import { describe, expect, it, vi } from "vitest";
import { NextFunction, Request } from "express";
import { z } from "zod";
import { AppException } from "../../src/exceptions/app.exception";
import { AppError } from "../../src/exceptions/errors/app.error";
import { FieldErrors, validate } from "../../src/middlewares/validate.middleware";
import { createResponse } from "../helpers/http";

const schema = z.object({
    name: z.string().trim().min(1),
    age: z.number(),
});
const fieldErrors: FieldErrors = { name: AppError.PRODUCT_NAME_REQUIRED };

const run = (source: "body" | "params" | "query", req: Partial<Request>, errors: FieldErrors = fieldErrors) => {
    const next = vi.fn();
    validate(source, schema, errors)(req as Request, createResponse(), next as unknown as NextFunction);
    return { next, error: next.mock.calls[0]?.[0] };
};

describe("validate middleware", () => {
    it("should call next() without error and replace the body with the cleaned data", () => {
        const req = { body: { name: "  Tornillo ", age: 3, extra: "se descarta" } };

        const { next } = run("body", req);

        expect(next).toHaveBeenCalledTimes(1);
        expect(next).toHaveBeenCalledWith();
        expect(req.body).toEqual({ name: "Tornillo", age: 3 });
    });

    it("should answer with the mapped business error when the field has one", () => {
        const { next, error } = run("body", { body: { name: "", age: 3 } });

        expect(next).toHaveBeenCalledTimes(1);
        expect(error).toBeInstanceOf(AppException);
        expect(error).toMatchObject({
            code: AppError.PRODUCT_NAME_REQUIRED.code,
            statusCode: AppError.PRODUCT_NAME_REQUIRED.statusCode,
            message: AppError.PRODUCT_NAME_REQUIRED.message,
        });
    });

    it("should answer VALIDATION_ERROR naming the field when it has no mapped error", () => {
        const { error } = run("body", { body: { name: "Tornillo", age: "tres" } });

        expect(error).toBeInstanceOf(AppException);
        expect(error).toMatchObject({ code: "VALIDATION_ERROR", statusCode: 400 });
        expect((error as AppException).message).toMatch(/^age: /);
    });

    it("should use VALIDATION_ERROR for every field when no mapping is given", () => {
        const { error } = run("body", { body: { name: "", age: 3 } }, {});

        expect(error).toMatchObject({ code: "VALIDATION_ERROR", statusCode: 400 });
        expect((error as AppException).message).toMatch(/^name: /);
    });

    it("should report the source when the whole value is invalid (e.g. no body)", () => {
        const { error } = run("body", { body: undefined });

        expect(error).toMatchObject({ code: "VALIDATION_ERROR", statusCode: 400 });
        expect((error as AppException).message).toMatch(/^body: /);
    });

    it("should only report the first problem when there are several", () => {
        const { next, error } = run("body", { body: { name: "", age: "x" } });

        expect(next).toHaveBeenCalledTimes(1);
        expect(error).toMatchObject({ code: AppError.PRODUCT_NAME_REQUIRED.code });
    });

    it("should validate the query without replacing it", () => {
        const query = { name: "Tornillo", age: 3 };
        const req = { query } as unknown as Partial<Request>;

        const { next } = run("query", req);

        expect(next).toHaveBeenCalledWith();
        expect(req.query).toBe(query);
    });

    it("should validate the route params", () => {
        const { error } = run("params", { params: { name: "x", age: "no-es-numero" } as never });

        expect(error).toMatchObject({ code: "VALIDATION_ERROR" });
    });
});
