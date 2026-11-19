import type { Metadata } from "next";
import { ReportEditor } from "../../components/report/report-editor";

export const metadata: Metadata = { title: "Your Sprint Recap", robots: { index: false, follow: false } };

export default function ReportPage() {
  return <ReportEditor/>;
}
