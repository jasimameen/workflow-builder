import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FlowBuilder — AI Workflow Builder",
  description: "Build visual workflows and generate Python code automatically",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
