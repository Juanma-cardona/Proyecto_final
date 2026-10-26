import { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import { AppException } from "../exceptions/app.exception";
import { AppError } from "../exceptions/errors/app.error";
import { ErrorDefinition } from "../exceptions/fail";

export type ValidationSource = "body" | "params" | "query";

/** Relaciona el nombre de un campo con el error de negocio que se devuelve cuando ese campo no es válido. */
export type FieldErrors = Readonly<Record<string, ErrorDefinition>>;

/**
 * Valida con un esquema de Zod la parte de la petición indicada (body, params o query).
 * - Si es válida, continúa (y en el body reemplaza los datos por los ya limpiados por Zod).
 * - Si no, responde con el primer error: el código del campo en `fieldErrors`, o VALIDATION_ERROR.
 */
export const validate =
    (source: ValidationSource, schema: ZodType, fieldErrors: FieldErrors = {}) =>
    (req: Request, _res: Response, next: NextFunction): void => {
        const result = schema.safeParse(req[source]);

        if (result.success) {
            // req.query es de solo lectura en Express 5, por eso solo se reemplaza el body.
            if (source === "body") req.body = result.data;
            next();
            return;
        }

        const issue = result.error.issues[0];
        const field = String(issue?.path[0] ?? "");
        const mapped = fieldErrors[field];

        if (mapped) {
            next(new AppException(mapped.code, mapped.statusCode, mapped.message));
            return;
        }

        const where = issue && issue.path.length > 0 ? issue.path.join(".") : source;
        const detail = issue?.message ?? AppError.VALIDATION_ERROR.message;
        next(
            new AppException(
                AppError.VALIDATION_ERROR.code,
                AppError.VALIDATION_ERROR.statusCode,
                `${where}: ${detail}`
            )
        );
    };
