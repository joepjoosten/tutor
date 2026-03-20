import type { Metadata, Viewport } from "next";
import { ConvexClientProvider } from "./ConvexClientProvider";
import AppHeader from "@/components/AppHeader";
import { getToken } from "@/lib/auth-server";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tutor App - Homework Helper",
  description: "Generate flashcards from homework images to help with studying",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Tutor App",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialToken = await getToken();

  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
      </head>
      <body className="antialiased">
        <ConvexClientProvider initialToken={initialToken}>
          <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
            <AppHeader />
            <main>{children}</main>
          </div>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
