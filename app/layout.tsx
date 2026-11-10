import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const onest = localFont({
  src: [
    { path: "./fonts/onest-latin-400-normal.woff2", weight: "400" },
    { path: "./fonts/onest-latin-500-normal.woff2", weight: "500" },
    { path: "./fonts/onest-latin-600-normal.woff2", weight: "600" },
    { path: "./fonts/onest-latin-700-normal.woff2", weight: "700" },
  ],
  variable: "--font",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Data Engine · Kiki's House Cleaning",
  description: "Tablero de inteligencia de negocio de Kiki's House Cleaning.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={onest.variable}>
      <body>{children}</body>
    </html>
  );
}
