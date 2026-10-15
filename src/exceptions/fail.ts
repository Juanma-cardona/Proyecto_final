import { AppException } from "./app.exception";

export interface ErrorDefinition {
    code: string;
    statusCode: number;
    message: string;
}

/** Lanza una AppException a partir de una definición de AppError. */
export function fail(error: ErrorDefinition): never {
    throw new AppException(error.code, error.statusCode, error.message);
}
