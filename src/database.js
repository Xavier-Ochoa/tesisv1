import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const connection = async () => {
  const uri = process.env.MONGODB_URI;
  console.log("DEBUG ─ Mongo URI:", uri);
  if (!uri) {
    throw new Error("❌ MONGODB_URI no definida. Revisa tus variables de entorno.");
  }

  try {
    const db = await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log(`✅ MongoDB conectado en ${db.connection.host}`);
  } catch (error) {
    console.log("❌ Error conectando Mongo:", error);
    throw error; // o maneja apropiadamente
  }
};

export default connection;
