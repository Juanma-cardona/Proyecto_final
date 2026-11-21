import "./config/env";
import { database } from "./config/container";
import app from "./server";

const PORT = Number(process.env.PORT ?? 3000);

const start = async (): Promise<void> => {
    if (database) {
        await database.connect();
        console.log("Connected to SQL Server");
    } else {
        console.log("Using in-memory storage (data is lost when the server restarts)");
    }

    const server = app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });

    const shutdown = async (): Promise<void> => {
        await new Promise<void>((resolve) => server.close(() => resolve()));
        try {
            await database?.close();
        } catch (error) {
            console.error("Error closing the database:", error);
        } finally {
            process.exit(0);
        }
    };
    process.on("SIGINT", () => void shutdown());
    process.on("SIGTERM", () => void shutdown());
};

start().catch((error: unknown) => {
    console.error("Could not start the server:", error);
    process.exit(1);
});
