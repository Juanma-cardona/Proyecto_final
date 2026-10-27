// Carga el archivo .env (si existe) antes de que se lea cualquier variable de entorno.
try {
    process.loadEnvFile();
} catch {
    // Sin .env se usan las variables del sistema y los valores por defecto.
}
