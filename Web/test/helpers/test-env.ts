// Imported first by every test file: the app refuses to start without these, and tests must never
// pick up the real DATABASE from .env (dotenv does not override variables that are already set).
process.env.NODE_ENV = "test";
process.env.DATABASE = "mongodb://127.0.0.1:1/never-used-by-tests";
process.env.JWT_SECRET = "test-jwt-secret";
process.env.FILE_MANAGER_SECRET = "test-file-manager-secret";
process.env.FEATURE_ML_FRAUD = process.env.FEATURE_ML_FRAUD ?? "false";
