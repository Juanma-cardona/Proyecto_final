export class AppException extends Error {
    constructor(
        public readonly code: string,
        public readonly statusCode: number = 400,
        public readonly message: string
    ) {
        super(message);
        Object.setPrototypeOf(this, AppException.prototype);
    }
}
