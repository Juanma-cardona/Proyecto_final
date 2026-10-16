import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextFunction, Request } from "express";
import { AppException } from "../../src/exceptions/app.exception";
import { errorMiddleware } from "../../src/middlewares/error.middleware";
import { createResponse } from "../helpers/http";

describe("errorMiddleware", () => {
    const req = {} as Request;
    const next = vi.fn() as unknown as NextFunction;

    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("should map an AppException to its status code, code and message", () => {
        const res = createResponse();

        errorMiddleware(new AppException("PRODUCT_NOT_FOUND", 404, "Product not found"), req, res, next);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ code: "PRODUCT_NOT_FOUND", message: "Product not found" });
        expect(console.error).not.toHaveBeenCalled();
    });

    it("should do nothing when the headers were already sent", () => {
        const res = createResponse({ headersSent: true });

        errorMiddleware(new AppException("X", 400, "x"), req, res, next);

        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).not.toHaveBeenCalled();
    });

    it("should answer 400 BAD_REQUEST for 4xx errors coming from express (e.g. malformed JSON)", () => {
        const res = createResponse();

        errorMiddleware(Object.assign(new Error("Unexpected token"), { status: 400 }), req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ code: "BAD_REQUEST", message: "Invalid request" });
    });

    it("should keep the original status for other 4xx errors (e.g. 413)", () => {
        const res = createResponse();

        errorMiddleware(Object.assign(new Error("too large"), { status: 413 }), req, res, next);

        expect(res.status).toHaveBeenCalledWith(413);
    });

    it.each([
        ["an unexpected Error", new Error("db exploded")],
        ["an error with a 5xx status", Object.assign(new Error("bad gateway"), { status: 502 })],
        ["an error with a status below 400", Object.assign(new Error("odd"), { status: 399 })],
        ["a string", "something"],
        ["null", null],
    ])("should answer 500 INTERNAL_SERVER_ERROR for %s and log it", (_label, error) => {
        const res = createResponse();

        errorMiddleware(error, req, res, next);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            code: "INTERNAL_SERVER_ERROR",
            message: "Internal Server Error",
        });
        expect(console.error).toHaveBeenCalledWith(error);
    });
});
