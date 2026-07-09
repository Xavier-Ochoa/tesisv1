import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs-extra';

/**
 * Subir imagen a Cloudinary desde archivo temporal
 * @param {string} filePath - Ruta del archivo temporal
 * @param {string} folder - Carpeta en Cloudinary (default: "Proyectos")
 * @returns {Object} - {secure_url, public_id}
 */
const subirImagenCloudinary = async (filePath, folder = "Proyectos") => {
    try {
        const { secure_url, public_id } = await cloudinary.uploader.upload(filePath, { 
            folder,
            resource_type: 'auto'
        });
        
        // Eliminar archivo temporal
        await fs.unlink(filePath);
        
        return { secure_url, public_id };
    } catch (error) {
        // Intentar eliminar el archivo temporal en caso de error
        try {
            await fs.unlink(filePath);
        } catch (unlinkError) {
            console.error('Error al eliminar archivo temporal:', unlinkError);
        }
        throw error;
    }
};

/**
 * Subir imagen Base64 a Cloudinary
 * @param {string} base64 - String Base64 de la imagen
 * @param {string} folder - Carpeta en Cloudinary (default: "Proyectos")
 * @returns {string} - URL segura de la imagen
 */
const subirBase64Cloudinary = async (base64, folder = "Proyectos") => {
    try {
        // Remover el prefijo data:image/...;base64,
        const buffer = Buffer.from(
            base64.replace(/^data:image\/\w+;base64,/, ''), 
            'base64'
        );
        
        const { secure_url, public_id } = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                { folder, resource_type: 'auto' },
                (err, res) => {
                    if (err) reject(err);
                    else resolve(res);
                }
            );
            stream.end(buffer);
        });
        
        return { secure_url, public_id };
    } catch (error) {
        throw error;
    }
};

/**
 * Eliminar imagen de Cloudinary
 * @param {string} publicId - ID público de la imagen en Cloudinary
 * @returns {Object} - Resultado de la eliminación
 */
const eliminarImagenCloudinary = async (publicId) => {
    try {
        const result = await cloudinary.uploader.destroy(publicId);
        return result;
    } catch (error) {
        console.error('Error al eliminar imagen de Cloudinary:', error);
        throw error;
    }
};

export {
    subirImagenCloudinary,
    subirBase64Cloudinary,
    eliminarImagenCloudinary
};
