import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-heebo",
});

export const metadata: Metadata = {
  title: "מתזמן משמרות",
  description: "מערכת לניהול וחלוקה הוגנת של משמרות",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he">
      <body className={`${heebo.variable} font-[family-name:var(--font-heebo)] antialiased min-h-screen`} dir="rtl"
        style={{ background: "var(--background)", color: "var(--foreground)" }}>
        <Nav />
        <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
