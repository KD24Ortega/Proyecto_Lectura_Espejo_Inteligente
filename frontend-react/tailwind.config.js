/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Espaciado sistemático (8/12/16/24/32/48/64px)
      // Nota: Tailwind ya incluye estos valores por defecto (p-2, p-3, p-4, p-6, p-8, p-12, p-16).
      // Estos alias hacen más explícito el sistema cuando se quiera usar.
      spacing: {
        xs: "8px",
        sm: "12px",
        md: "16px",
        lg: "24px",
        xl: "32px",
        "2xl": "48px",
        "3xl": "64px",
      },

      // Bordes redondeados estandarizados
      borderRadius: {
        "ui-sm": "12px",
        "ui-md": "16px",
        "ui-lg": "24px",
        "ui-xl": "32px",
        "ui-pill": "9999px",
      },

      // Sombras estandarizadas (reemplazo de shadow-* default en UI)
      boxShadow: {
        card: "0 10px 30px rgba(0, 0, 0, 0.12)",
        elevated: "0 16px 40px rgba(0, 0, 0, 0.18)",
        modal: "0 28px 80px rgba(0, 0, 0, 0.30)",
      },
    },
  },
  plugins: [],
}