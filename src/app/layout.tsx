import type { Metadata } from "next";
import { Marcellus_SC, Roboto_Condensed } from "next/font/google";
import { AdminLayout } from "@/components/layout";
import "@/styles/globals.scss";

const marcellusSC = Marcellus_SC({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const robotoCondensed = Roboto_Condensed({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Darkpoint Admin",
    template: "%s | Darkpoint Admin",
  },
  description: "Admin dashboard for Darkpoint store management",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html 
      lang="en" 
      className={`${marcellusSC.variable} ${robotoCondensed.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        <AdminLayout>
          {children}
        </AdminLayout>
      </body>
    </html>
  );
}
