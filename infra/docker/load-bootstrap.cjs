// Runs before any Node entry point, including the database migration CLI.
if (process.env.BOOTSTRAP_ENV_FILE) process.loadEnvFile(process.env.BOOTSTRAP_ENV_FILE);
