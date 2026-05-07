import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import app from "./server.js";

async function startServer() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Conectado a MongoDB");

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    });

  } catch (error) {
    console.error("❌ Error al iniciar servidor:", error);
  }
}

startServer();