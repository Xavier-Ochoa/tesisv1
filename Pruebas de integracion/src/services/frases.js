import fetch from "node-fetch";
import { translateText } from "./translateApi.js";

export const getRandomQuote = async () => {
  try {
    const url = "https://zenquotes.io/api/random";

    const response = await fetch(url);
    if (!response.ok) throw new Error("Error al obtener la cita");

    const data = await response.json();

    if (Array.isArray(data) && data.length > 0) {
      const quote = data[0].q;
      const author = data[0].a;

      const translatedQuote = await translateText(quote);

      return { q: translatedQuote, a: author };
    } else {
      return { q: "No se pudo cargar la cita", a: "" };
    }
  } catch (error) {
    console.error("Error fetching quote:", error);
    return { q: "No se pudo cargar la cita", a: "" };
  }
};
