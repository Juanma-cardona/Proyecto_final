import "./config/env";
import { database } from "./config/container";
import { createServer } from "./server";

const PORT = Number(process.env.PORT ?? 3000);

const start = async (): Promise<void> => {
    if (database) {
        await database.connect();
        console.log("Connected to SQL Server");
    } else {
        console.log("Using in-memory storage (data is lost when the server restarts)");
    }

    const server = createServer().listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });

    const shutdown = (): void => {
        server.close(() => {
            (database ? database.close() : Promise.resolve()).finally(() => process.exit(0));
        });
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
};

start().catch((error: unknown) => {
    console.error("Could not start the server:", error);
    process.exit(1);
});
