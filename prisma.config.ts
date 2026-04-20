// ================================================================
// prisma.config.ts
// Configuración de Prisma 7 - Las URLs de conexión van aquí
// (ya no en schema.prisma como en versiones anteriores)
// ================================================================
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // DIRECT_URL: conexión directa para migraciones (sin pgbouncer)
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
