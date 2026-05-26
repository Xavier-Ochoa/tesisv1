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
import chatRoutes from "./routes/chat_routes.js";
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
app.use(express.urlencoded({ extended: true }));

// CORS
app.use(
  cors({
    origin: [
      'https://poliexpo-esfot.vercel.app',
      'http://localhost:4200',
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

// NOTA: fileUpload NO se registra aquí globalmente.
// Se aplica por ruta en auth_routes.js y proyecto_routes.js
// importando desde ./middlewares/upload.js (sin ciclo).

// ===== RUTAS =====

app.get("/", (req, res) => {
  res.send("API de Proyectos ESFOT - EPN");
});

app.use("/api/auth", authRoutes);
app.use("/api/proyectos", proyectoRoutes);
app.use("/api/admin/proyectos", proyectoAdminRoutes);
app.use("/api/admin/estudiantes", estudianteRoutes);
app.use("/api/donaciones", donacionRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/ia", iaRoutes);
app.use("/api/chat", chatRoutes);

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
