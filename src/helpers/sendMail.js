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
        "Bienvenido a ESFOT — Tu token de verificación 🎓",
        `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px; border: 1px solid #e0e0e0; border-radius: 12px; background: #ffffff;">

                <!-- HEADER -->
                <div style="text-align: center; margin-bottom: 24px;">
                    <h1 style="color: #003366; margin: 0 0 6px 0;">¡Bienvenido a ESFOT!</h1>
                    <p style="color: #666; font-size: 15px; margin: 0;">Sistema de Gestión de Proyectos Académicos · EPN</p>
                </div>

                <p style="color: #333; font-size: 15px; line-height: 1.7; margin-bottom: 24px;">
                    Hola, gracias por registrarte. Para activar tu cuenta copia el token de verificación
                    que aparece a continuación e ingrésalo en la aplicación cuando se te solicite.
                </p>

                <!-- TOKEN BOX -->
                <div style="background: #f0f4ff; border: 2px dashed #003366; border-radius: 10px; padding: 28px 20px; text-align: center; margin: 0 0 24px 0;">
                    <p style="margin: 0 0 10px 0; font-size: 13px; color: #555; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600;">
                        🔑 Tu token de verificación es:
                    </p>
                    <p style="
                        margin: 0;
                        font-size: 26px;
                        font-weight: 700;
                        letter-spacing: 0.18em;
                        color: #003366;
                        font-family: 'Courier New', Courier, monospace;
                        word-break: break-all;
                        background: #ffffff;
                        border-radius: 6px;
                        padding: 14px 18px;
                        display: inline-block;
                        border: 1px solid #c5d3f0;
                    ">
                        ${token}
                    </p>
                    <p style="margin: 14px 0 0 0; font-size: 12px; color: #888;">
                        Cópialo exactamente como aparece, respetando mayúsculas y minúsculas.
                    </p>
                </div>

                <!-- INSTRUCCIONES -->
                <div style="background: #e8f4f8; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
                    <p style="margin: 0 0 8px 0; color: #003366; font-size: 14px; font-weight: 700;">🎯 ¿Cómo usarlo?</p>
                    <ol style="color: #444; font-size: 14px; line-height: 1.9; margin: 0; padding-left: 18px;">
                        <li>Copia el token de la caja azul de arriba.</li>
                        <li>Abre la aplicación y ve a <strong>Verificar cuenta</strong>.</li>
                        <li>Pega el token en el campo indicado y confirma.</li>
                        <li>¡Listo! Ya puedes iniciar sesión y publicar tus proyectos.</li>
                    </ol>
                </div>

                <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 24px 0;">

                <footer style="text-align: center; color: #aaa; font-size: 12px;">
                    <p style="margin: 4px 0;"><strong style="color: #003366;">Escuela de Formación de Tecnólogos (ESFOT)</strong></p>
                    <p style="margin: 4px 0;">Escuela Politécnica Nacional</p>
                    <p style="margin: 12px 0 0 0; color: #bbb;">Si no solicitaste esta cuenta, ignora este mensaje.</p>
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
        "Recupera tu contraseña — Token de restablecimiento 🔐",
        `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px; border: 1px solid #e0e0e0; border-radius: 12px; background: #ffffff;">

                <!-- HEADER -->
                <div style="text-align: center; margin-bottom: 24px;">
                    <h1 style="color: #d32f2f; margin: 0 0 6px 0;">🔐 Recuperación de Contraseña</h1>
                    <p style="color: #666; font-size: 15px; margin: 0;">Sistema de Proyectos ESFOT · EPN</p>
                </div>

                <p style="color: #333; font-size: 15px; line-height: 1.7; margin-bottom: 24px;">
                    Has solicitado restablecer tu contraseña. Copia el token que aparece
                    a continuación e ingrésalo en la aplicación para crear una nueva contraseña.
                    Si no fuiste tú, ignora este mensaje — tu contraseña no cambiará.
                </p>

                <!-- TOKEN BOX -->
                <div style="background: #fff5f5; border: 2px dashed #d32f2f; border-radius: 10px; padding: 28px 20px; text-align: center; margin: 0 0 24px 0;">
                    <p style="margin: 0 0 10px 0; font-size: 13px; color: #555; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600;">
                        🔑 Tu token de restablecimiento es:
                    </p>
                    <p style="
                        margin: 0;
                        font-size: 26px;
                        font-weight: 700;
                        letter-spacing: 0.18em;
                        color: #c62828;
                        font-family: 'Courier New', Courier, monospace;
                        word-break: break-all;
                        background: #ffffff;
                        border-radius: 6px;
                        padding: 14px 18px;
                        display: inline-block;
                        border: 1px solid #f5c5c5;
                    ">
                        ${token}
                    </p>
                    <p style="margin: 14px 0 0 0; font-size: 12px; color: #888;">
                        Cópialo exactamente como aparece, respetando mayúsculas y minúsculas.
                    </p>
                </div>

                <!-- INSTRUCCIONES -->
                <div style="background: #fff3e0; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px; border-left: 4px solid #ff9800;">
                    <p style="margin: 0 0 8px 0; color: #e65100; font-size: 14px; font-weight: 700;">🎯 ¿Cómo usarlo?</p>
                    <ol style="color: #444; font-size: 14px; line-height: 1.9; margin: 0; padding-left: 18px;">
                        <li>Copia el token de la caja de arriba.</li>
                        <li>Abre la aplicación y ve a <strong>Restablecer contraseña</strong>.</li>
                        <li>Pega el token en el campo indicado.</li>
                        <li>Escribe y confirma tu nueva contraseña.</li>
                    </ol>
                </div>

                <!-- ADVERTENCIA -->
                <div style="background: #ffebee; border-radius: 8px; padding: 14px 18px; margin-bottom: 24px; border-left: 4px solid #d32f2f;">
                    <p style="margin: 0; color: #333; font-size: 13px; line-height: 1.8;">
                        <strong>⚠️ Importante:</strong> este token es de uso único y expira en <strong>1 hora</strong>. 
                        No lo compartas con nadie.
                    </p>
                </div>

                <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 24px 0;">

                <footer style="text-align: center; color: #aaa; font-size: 12px;">
                    <p style="margin: 4px 0;"><strong style="color: #003366;">Escuela de Formación de Tecnólogos (ESFOT)</strong></p>
                    <p style="margin: 4px 0;">Escuela Politécnica Nacional</p>
                    <p style="margin: 12px 0 0 0; color: #bbb;">Por tu seguridad, nunca compartas este token con nadie.</p>
                </footer>

            </div>
        `
    )
}

/**
 * Enviar email de notificación de cambio de contraseña
 * @param {string} userMail  - Email del estudiante
 * @param {string} nombre    - Nombre del estudiante para personalizar el saludo
 * @returns {Promise} Resultado del envío del email
 */
const sendMailToPasswordChanged = (userMail, nombre) => {
    const fecha = new Date().toLocaleString('es-EC', {
        timeZone: 'America/Guayaquil',
        dateStyle: 'full',
        timeStyle: 'short',
    });

    return sendMail(
        userMail,
        "Aviso de seguridad — Tu contraseña fue cambiada 🔒",
        `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px; border: 1px solid #e0e0e0; border-radius: 12px; background: #ffffff;">

                <!-- HEADER -->
                <div style="text-align: center; margin-bottom: 24px;">
                    <h1 style="color: #1a3c5e; margin: 0 0 6px 0;">🔒 Cambio de Contraseña</h1>
                    <p style="color: #666; font-size: 15px; margin: 0;">Sistema de Proyectos ESFOT · EPN</p>
                </div>

                <!-- SALUDO -->
                <p style="color: #333; font-size: 15px; line-height: 1.7; margin-bottom: 20px;">
                    Hola <strong>${nombre}</strong>, te informamos que la contraseña de tu cuenta fue
                    actualizada exitosamente.
                </p>

                <!-- CAJA DE CONFIRMACIÓN -->
                <div style="background: #f0f7f0; border: 2px solid #2e7d32; border-radius: 10px; padding: 20px 24px; text-align: center; margin-bottom: 24px;">
                    <p style="margin: 0 0 6px 0; font-size: 13px; color: #555; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600;">
                        ✅ Cambio registrado el
                    </p>
                    <p style="margin: 0; font-size: 16px; font-weight: 700; color: #2e7d32;">
                        ${fecha}
                    </p>
                </div>

                <!-- ADVERTENCIA SI NO FUE EL USUARIO -->
                <div style="background: #fff3e0; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px; border-left: 4px solid #ff9800;">
                    <p style="margin: 0 0 6px 0; color: #e65100; font-size: 14px; font-weight: 700;">⚠️ ¿No reconoces este cambio?</p>
                    <p style="margin: 0; color: #444; font-size: 14px; line-height: 1.8;">
                        Si no fuiste tú quien realizó este cambio, tu cuenta puede estar comprometida.
                        Contacta de inmediato al administrador del sistema para proteger tu cuenta.
                    </p>
                </div>

                <!-- RECOMENDACIONES -->
                <div style="background: #e8f4f8; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
                    <p style="margin: 0 0 8px 0; color: #003366; font-size: 14px; font-weight: 700;">🛡️ Recomendaciones de seguridad</p>
                    <ul style="color: #444; font-size: 14px; line-height: 1.9; margin: 0; padding-left: 18px;">
                        <li>Nunca compartas tu contraseña con nadie.</li>
                        <li>Usa una contraseña única para esta plataforma.</li>
                        <li>Si sospechas actividad inusual, cierra sesión en todos tus dispositivos.</li>
                    </ul>
                </div>

                <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 24px 0;">

                <footer style="text-align: center; color: #aaa; font-size: 12px;">
                    <p style="margin: 4px 0;"><strong style="color: #003366;">Escuela de Formación de Tecnólogos (ESFOT)</strong></p>
                    <p style="margin: 4px 0;">Escuela Politécnica Nacional</p>
                    <p style="margin: 12px 0 0 0; color: #bbb;">Este es un mensaje automático, por favor no respondas a este correo.</p>
                </footer>

            </div>
        `
    );
};

export {
    sendMailToRegister,
    sendMailToRecoveryPassword,
    sendMailToPasswordChanged,
}
