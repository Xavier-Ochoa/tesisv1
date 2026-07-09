import Stripe from "stripe";
import Donacion from "../models/Donacion.js";

const stripe = new Stripe(process.env.STRIPE_PRIVATE_KEY);

export const donarPlataforma = async (req, res) => {
  try {
    const { paymentMethodId, monto, nombre, mensaje } = req.body;

    // ===== VALIDACIONES =====
    if (!paymentMethodId || !monto) {
      return res.status(400).json({
        success: false,
        message: "Faltan datos obligatorios: método de pago y monto",
      });
    }

    if (monto < 2 || monto > 1000) {
      return res.status(400).json({
        success: false,
        message: "El monto debe estar entre $2 y $1000",
      });
    }

    // ===== CREAR PAGO EN STRIPE =====
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(monto * 100),
      currency: "usd",
      description: `Donación a la plataforma`,
      payment_method: paymentMethodId,
      confirm: true,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: "never",
      },
    });

    // ===== VERIFICAR PAGO =====
    if (paymentIntent.status !== "succeeded") {
      return res.status(400).json({
        success: false,
        message: "El pago no se completó",
        stripeStatus: paymentIntent.status,
      });
    }

    // ===== GUARDAR DONACIÓN EN MONGODB =====
    const nuevaDonacion = await Donacion.create({
      donanteNombre: nombre || 'Anónimo',
      monto,
      mensaje: mensaje || '',
      stripePaymentIntentId: paymentIntent.id,
      estado: "exitosa",
    });

    // ===== RESPUESTA FINAL =====
    res.status(200).json({
      success: true,
      message: "🎉 ¡Gracias por tu donación a la plataforma!",
      data: {
        donacionId: nuevaDonacion._id,
        nombreDonante: nuevaDonacion.donanteNombre,
        monto,
        mensaje: nuevaDonacion.mensaje,
        fecha: nuevaDonacion.createdAt,
        stripePaymentIntentId: paymentIntent.id,
      },
    });

  } catch (error) {
    console.error("❌ Error en donación:", error);
    res.status(500).json({
      success: false,
      message: "Error al procesar la donación",
      error: error.message,
    });
  }
};
