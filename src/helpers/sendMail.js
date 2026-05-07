import { sendMail } from "../config/nodemailer.js"

/**
 * Enviar email de confirmación de registro
 * @param {string} userMail - Email del estudiante
 * @param {string} token - Token de confirmación
 * @returns {Promise} Resultado del envío del email
 */
const sendMailToRegister = (userMail, token) => {
    return sendMail(
        userMail,
        "Bienvenido a ESFOT - Sistema de Proyectos Académicos 🎓📚",
        `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h1 style="color: #003366;">¡Bienvenido a ESFOT!</h1>
                    <p style="color: #666; font-size: 16px;">Sistema de Gestión de Proyectos Académicos</p>
                </div>
                
                <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h2 style="color: #003366; margin-top: 0;">Confirma tu cuenta</h2>
                    <p style="color: #333; line-height: 1.6;">
                        Hola, gracias por registrarte en nuestro sistema de proyectos académicos. 
                        Para activar tu cuenta y comenzar a publicar tus proyectos, 
                        haz clic en el siguiente botón:
                    </p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${process.env.URL_BACKEND}api/auth/confirm/${token}" 
                           style="background-color: #003366; color: white; padding: 15px 40px; 
                                  text-decoration: none; border-radius: 5px; font-size: 16px; 
                                  display: inline-block; font-weight: bold;">
                            ✅ Confirmar mi cuenta
                        </a>
                    </div>
                    
                    <p style="color: #666; font-size: 14px; margin-top: 20px;">
                        Si el botón no funciona, copia y pega este enlace en tu navegador:
                        <br>
                        <a href="${process.env.URL_BACKEND}api/auth/confirm/${token}" 
                           style="color: #003366; word-break: break-all;">
                            ${process.env.URL_BACKEND}auth/confirm/${token}
                        </a>
                    </p>
                </div>
                
                <div style="margin-top: 20px; padding: 15px; background-color: #e8f4f8; border-radius: 8px;">
                    <p style="margin: 0; color: #333; font-size: 14px;">
                        <strong>🎯 Próximos pasos:</strong>
                    </p>
                    <ul style="color: #666; font-size: 14px; line-height: 1.8;">
                        <li>Confirma tu cuenta haciendo clic en el botón</li>
                        <li>Inicia sesión en el sistema</li>
                        <li>Publica tus proyectos académicos y extracurriculares</li>
                        <li>Comparte tu trabajo con la comunidad ESFOT</li>
                    </ul>
                </div>
                
                <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
                
                <footer style="text-align: center; color: #999; font-size: 12px;">
                    <p style="margin: 5px 0;">
                        <strong style="color: #003366;">Escuela de Formación de Tecnólogos (ESFOT)</strong>
                    </p>
                    <p style="margin: 5px 0;">Escuela Politécnica Nacional</p>
                    <p style="margin: 5px 0;">Sistema de Gestión de Proyectos Académicos</p>
                    <p style="margin: 15px 0 5px 0; color: #666;">
                        Si no solicitaste esta cuenta, puedes ignorar este mensaje.
                    </p>
                </footer>
            </div>
        `
    )
}

/**
 * Enviar email de recuperación de contraseña
 * @param {string} userMail - Email del estudiante
 * @param {string} token - Token de recuperación
 * @returns {Promise} Resultado del envío del email
 */
const sendMailToRecoveryPassword = (userMail, token) => {
    return sendMail(
        userMail,
        "Recupera tu contraseña - ESFOT 🔐",
        `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h1 style="color: #d32f2f;">🔐 Recuperación de Contraseña</h1>
                    <p style="color: #666; font-size: 16px;">Sistema de Proyectos ESFOT - EPN</p>
                </div>
                
                <div style="background-color: #fff3e0; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ff9800;">
                    <h2 style="color: #e65100; margin-top: 0;">Restablecer Contraseña</h2>
                    <p style="color: #333; line-height: 1.6;">
                        Has solicitado restablecer tu contraseña. Si no fuiste tú, 
                        puedes ignorar este mensaje de forma segura.
                    </p>
                    <p style="color: #333; line-height: 1.6;">
                        Para crear una nueva contraseña, haz clic en el siguiente botón:
                    </p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${process.env.URL_BACKEND}api/auth/recuperarpassword/${token}" 
                           style="background-color: #d32f2f; color: white; padding: 15px 40px; 
                                  text-decoration: none; border-radius: 5px; font-size: 16px; 
                                  display: inline-block; font-weight: bold;">
                            🔑 Restablecer mi contraseña
                        </a>
                    </div>
                    
                    <p style="color: #666; font-size: 14px; margin-top: 20px;">
                        Si el botón no funciona, copia y pega este enlace en tu navegador:
                        <br>
                        <a href="${process.env.URL_BACKEND}api/auth/recuperarpassword/${token}" 
                           style="color: #d32f2f; word-break: break-all;">
                            ${process.env.URL_BACKEND}api/auth/recuperarpassword/${token}
                        </a>
                    </p>
                </div>
                
                <div style="margin-top: 20px; padding: 15px; background-color: #ffebee; border-radius: 8px; border-left: 4px solid #d32f2f;">
                    <p style="margin: 0 0 10px 0; color: #333; font-size: 14px;">
                        <strong>⚠️ Importante:</strong>
                    </p>
                    <ul style="color: #666; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                        <li>Este enlace es válido por <strong>24 horas</strong></li>
                        <li>Solo puede usarse <strong>una vez</strong></li>
                        <li>Si no solicitaste este cambio, <strong>ignora este email</strong></li>
                        <li>Tu contraseña actual seguirá siendo válida hasta que la cambies</li>
                    </ul>
                </div>
                
                <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
                
                <footer style="text-align: center; color: #999; font-size: 12px;">
                    <p style="margin: 5px 0;">
                        <strong style="color: #003366;">Escuela de Formación de Tecnólogos (ESFOT)</strong>
                    </p>
                    <p style="margin: 5px 0;">Escuela Politécnica Nacional</p>
                    <p style="margin: 5px 0;">Sistema de Gestión de Proyectos Académicos</p>
                    <p style="margin: 15px 0 5px 0; color: #666;">
                        Por tu seguridad, nunca compartas este enlace con nadie.
                    </p>
                </footer>
            </div>
        `
    )
}

export {
    sendMailToRegister,
    sendMailToRecoveryPassword
}