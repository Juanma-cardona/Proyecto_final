import { NextFunction, Request, Response } from "express";
import { AppException } from "../exceptions/app.exception";

export const errorMiddleware = (
    err: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction
): void => {
    if (res.headersSent) {
        return;
    }

    if (err instanceof AppException) {
        res.status(err.statusCode).json({ code: err.code, message: err.message });
        return;
    }

    // JSON mal formado u otros errores 4xx de express (body-parser expone `status`)
    const status = (err as { status?: number })?.status;
    if (typeof status === "number" && status >= 400 && status < 500) {
        res.status(status).json({ code: "BAD_REQUEST", message: "Invalid request" });
        return;
    }

    console.error(err);
    res.status(500).json({ code: "INTERNAL_SERVER_ERROR", message: "Internal Server Error" });
};
