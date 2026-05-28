/**
 * gridfs.js
 * Utilidades para guardar y eliminar PDFs en GridFS (bucket: proyectos_docs).
 * Usa la conexión activa de Mongoose, por lo que debe llamarse DESPUÉS
 * de que la BD esté conectada.
 */
import mongoose from 'mongoose';
import { GridFSBucket } from 'mongodb';
import { Readable } from 'stream';

const BUCKET_NAME = 'proyectos_docs';

/**
 * Devuelve una instancia del bucket GridFS.
 * @returns {GridFSBucket}
 */
export const getBucket = () => {
  const db = mongoose.connection.db;
  if (!db) throw new Error('La conexión a MongoDB no está lista para GridFS');
  return new GridFSBucket(db, { bucketName: BUCKET_NAME });
};

/**
 * Sube un Buffer como PDF a GridFS y devuelve la metadata guardada.
 *
 * @param {Buffer} buffer       - Contenido del archivo
 * @param {string} filename     - Nombre del archivo (ej: 'proyecto.pdf')
 * @param {string} contentType  - MIME type (default: 'application/pdf')
 * @returns {Promise<{ fileId: ObjectId, filename: string, size: number, contentType: string, uploadDate: Date }>}
 */
export const subirPDFGridFS = (buffer, filename, contentType = 'application/pdf') => {
  return new Promise((resolve, reject) => {
    const bucket = getBucket();
    const readableStream = Readable.from(buffer);

    const uploadStream = bucket.openUploadStream(filename, {
      contentType,
      metadata: { uploadedAt: new Date() },
    });

    readableStream.pipe(uploadStream);

    uploadStream.on('finish', () => {
      resolve({
        fileId:      uploadStream.id,
        filename,
        size:        uploadStream.length,
        contentType,
        uploadDate:  new Date(),
      });
    });

    uploadStream.on('error', reject);
    readableStream.on('error', reject);
  });
};

/**
 * Elimina un archivo de GridFS por su fileId (ObjectId).
 * Si el archivo no existe, no lanza error.
 *
 * @param {ObjectId|string} fileId
 */
export const eliminarPDFGridFS = async (fileId) => {
  try {
    const bucket = getBucket();
    const id = typeof fileId === 'string' ? new mongoose.Types.ObjectId(fileId) : fileId;
    await bucket.delete(id);
  } catch (err) {
    // GridFS lanza error si el archivo no existe; lo ignoramos para no romper el flujo
    if (!err.message?.includes('File not found')) {
      console.error('Error eliminando PDF de GridFS:', err.message);
    }
  }
};

/**
 * Abre un stream de descarga de GridFS para un fileId dado.
 * Útil para el endpoint de descarga/visualización.
 *
 * @param {ObjectId|string} fileId
 * @returns {GridFSBucketReadStream}
 */
export const descargarPDFGridFS = (fileId) => {
  const bucket = getBucket();
  const id = typeof fileId === 'string' ? new mongoose.Types.ObjectId(fileId) : fileId;
  return bucket.openDownloadStream(id);
};
