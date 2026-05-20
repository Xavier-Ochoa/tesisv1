// middlewares/upload.js
// Separado de server.js para evitar dependencias circulares.
// Las rutas importan desde aquí, NO desde server.js.
import fileUpload from 'express-fileupload';

export const fileUploadMiddleware = fileUpload({
  useTempFiles: true,
  tempFileDir: process.env.NODE_ENV === 'production' ? '/tmp' : './uploads',
  createParentPath: true,
  debug: false,
});
