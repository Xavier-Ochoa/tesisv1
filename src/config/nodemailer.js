import nodemailer from "nodemailer"
import dotenv from "dotenv"
dotenv.config()



const transporter = nodemailer.createTransport({    
    service: "gmail",
    auth: {
        user: process.env.USER_MAILTRAP,
        pass: process.env.PASS_MAILTRAP,
    },
    tls: {
        rejectUnauthorized: false  // 👈 Esto resuelve el problema del certificado
    }
})

// Verificar conexión
transporter.verify((error, success) => {
    if (error) {
        console.error("❌ Error configuración Nodemailer:", error)
    } else {
        console.log("✅ Servidor de correo listo para enviar mensajes")
    }
})

/**
 * Función genérica para enviar correos
 * @param {string} to - Email del destinatario
 * @param {string} subject - Asunto del correo
 * @param {string} html - Contenido HTML del correo
 */
const sendMail = async (to, subject, html) => {
    try {
        console.log("📧 Intentando enviar email a:", to)
        
        const info = await transporter.sendMail({
            from: `"PoliExpo" <${process.env.USER_MAILTRAP}>"`,
            to,
            subject,
            html,
        })
        
        console.log("✅ Email enviado exitosamente!")
        console.log("📩 Message ID:", info.messageId)
        console.log("📬 Preview URL:", nodemailer.getTestMessageUrl(info))
        
        return { success: true, messageId: info.messageId }
        
    } catch (error) {
        console.error("❌ Error enviando email:")
        console.error("   Destinatario:", to)
        console.error("   Error:", error.message)
        console.error("   Código:", error.code)
        console.error("   Stack:", error.stack)
        
        return { success: false, error: error.message }
    }
}

const sendMailToRecoveryPassword = (userMail, token) => {

    return sendMail(
        userMail,
        "Recupera tu contraseña",
        `
            <h1>PoliExpo – 🧠📂</h1>
            <p>Has solicitado restablecer tu contraseñab.</p>
            <a href="${process.env.URL_FRONTEND}recuperarpassword/${token}">
            Clic para restablecer tu contraseña
            </a>
            <hr>
            <footer>El equipo de PoliExpo te da la más cordial bienvenida.</footer>
        `
        )
}


export {
    sendMail,                 // 👈 exporta la función base
    sendMailToRecoveryPassword // 👈 exporta también la específica
}