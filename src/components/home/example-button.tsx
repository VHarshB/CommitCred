"use client";

import { useRouter } from "next/navigation";
import { exampleReport } from "../../lib/report/example";
import { saveReport } from "../../lib/report/session";

export function ExampleButton() {
  const router = useRouter();

  return <button type="button" className="button secondary" onClick={() => {
    saveReport(exampleReport());
    router.push("/report");
  }}>Open editable sample</button>;
}
