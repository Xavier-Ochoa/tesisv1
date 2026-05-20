// server.js
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth_routes.js";
import proyectoRoutes from "./routes/proyecto_routes.js";
import proyectoAdminRoutes from "./routes/proyectoadmin_routes.js";
import estudianteRoutes from "./routes/estudiante_routes.js";
import donacionRoutes from "./routes/donacion_routes.js";
import dashboardRoutes from "./routes/dashboard_routes.js";
import iaRoutes from "./routes/ia_routes.js";
import fileUpload from "express-fileupload";
export const fileUploadMiddleware = fileUpload({
  useTempFiles: true,
  tempFileDir: process.env.NODE_ENV === 'production' ? '/tmp' : './uploads',
  createParentPath: true,
  debug: false,
});
import { v2 as cloudinary } from 'cloudinary';

// ===== CONFIGURACIÓN DE CLOUDINARY =====
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const app = express();

// ===== MIDDLEWARES =====

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // necesario para form-data sin archivos

// CORS
app.use(
  cors({
    origin: [
      'https://poliexpo-esfot.vercel.app',
      'http://localhost:5173',
      'http://localhost:3000',
      'http://127.0.0.1:5500',
      'https://tesisfrontend2.vercel.app',
      'https://examen-back-v1.vercel.app',
      process.env.URL_FRONTEND || "*"
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  })
);

// fileUpload NO se aplica globalmente para no interferir con headers JWT.
// Se aplica por ruta en auth_routes.js y proyecto_routes.js

// ===== RUTAS =====

app.get("/", (req, res) => {
  res.send("API de Proyectos ESFOT - EPN");
});

// Autenticación (registro con rol estudiante/docente, login, perfil)
app.use("/api/auth", authRoutes);

// Proyectos (estudiantes y docentes)
app.use("/api/proyectos", proyectoRoutes);

// Proyectos (solo administrador)
app.use("/api/admin/proyectos", proyectoAdminRoutes);

// Gestión de usuarios (solo administrador)
app.use("/api/admin/estudiantes", estudianteRoutes);

// Donaciones
app.use("/api/donaciones", donacionRoutes);

// Dashboard (estadísticas)
app.use("/api/dashboard", dashboardRoutes);

// IA (sugerencias de títulos con Hugging Face)
app.use("/api/ia", iaRoutes);

// ===== MANEJO DE ERRORES =====

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Endpoint no encontrado - 404"
  });
});

app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  res.status(500).json({
    success: false,
    message: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

export default app;
