import type { Metadata } from "next";
import { Footer, Header } from "../components/layout/chrome";
import "./globals.css";

const title = "CommitCred — Your Commits. Your Credit.";
const description = "Turn your GitHub contributions into clean, editable sprint reports with source-linked evidence. No sign-up required.";

export const metadata: Metadata = {
  title: { default: title, template: "%s | CommitCred" },
  description,
  openGraph: { title, description, type: "website", siteName: "CommitCred" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-scroll-behavior="smooth"><body><a className="skip-link" href="#main">Skip to content</a><Header/>{children}<Footer/></body></html>;
}
