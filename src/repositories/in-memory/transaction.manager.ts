import { ITransactionManager } from "../interfaces/database.interface";

/** Con datos en memoria no hay nada que revertir: solo ejecuta el trabajo. */
export class InMemoryTransactionManager implements ITransactionManager {
    async run<T>(work: () => Promise<T>): Promise<T> {
        return work();
    }
}
