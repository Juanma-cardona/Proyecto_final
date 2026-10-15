import { AwilixContainer } from "awilix";

declare global {
    namespace Express {
        interface Request {
            /** Contenedor por request, lo inyecta scopePerRequest de awilix-express. */
            container: AwilixContainer;
        }
    }
}

export {};
