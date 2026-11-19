import type { Metadata } from "next";
import { Footer, Header } from "../components/layout/chrome";
import { siteDescription, siteTitle } from "../lib/seo/site";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: siteTitle, template: "%s | CommitCred" },
  description: siteDescription,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-scroll-behavior="smooth"><body><a className="skip-link" href="#main">Skip to content</a><Header/>{children}<Footer/></body></html>;
}
