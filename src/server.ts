import express from "express";
import { scopePerRequest } from "awilix-express";
import { container, database } from "./config/container";
import { errorMiddleware } from "./middlewares/error.middleware";
import V1Routes from "./routes/v1/index";

let databaseConnection: Promise<void> | undefined;

export const connectDatabase = async (): Promise<void> => {
    if (!database) return;

    databaseConnection ??= database.connect().catch((error: unknown) => {
        databaseConnection = undefined;
        throw error;
    });

    await databaseConnection;
};

export const createServer = () => {
    const app = express();

    // Vercel serves this Express app directly and does not run main.ts.
    // Connect lazily once per warm instance before handling API requests.
    app.use((_req, _res, next) => {
        void connectDatabase().then(() => next()).catch(next);
    });
    app.use(express.json());
    app.use(scopePerRequest(container));
    app.use("/api", V1Routes);
    app.use(errorMiddleware);

    return app;
};

// Vercel's Express runtime discovers this file and serves the default-exported app.
const app = createServer();

export default app;
