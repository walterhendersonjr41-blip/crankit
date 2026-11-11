/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        garage: {
          bg: "#121212",
          card: "#1E1E1E",
          orange: "#FF6B00",
        },
        diy: "#22C55E",
        bolt: "#EAB308",
        shop: "#EF4444",
      },
    },
  },
  plugins: [],
};
