import type { Metadata } from "next";
import { DM_Sans, Plus_Jakarta_Sans, Space_Mono } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { AuthGate, AuthProvider } from "@/lib/auth";
import { StoreProvider } from "@/lib/store";
import "./globals.css";

const display = Plus_Jakarta_Sans({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const sans = DM_Sans({
  variable: "--font-dm",
  subsets: ["latin"],
});

const mono = Space_Mono({
  variable: "--font-space",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Promptie",
  description: "Sign in with Google, fill prompt templates for each company, and test a store checkout.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="h-full">
        <AuthProvider>
          <AuthGate>
            <StoreProvider>
              <AppShell>{children}</AppShell>
            </StoreProvider>
          </AuthGate>
        </AuthProvider>
      </body>
    </html>
  );
}
