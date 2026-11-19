import Link from "next/link";
import { ExampleButton } from "../../../components/home/example-button";
import { ResourcePage } from "../../../components/layout/resource-page";
import { pageMetadata } from "../../../lib/seo/site";

export const dynamic = "force-dynamic";

const title = "GitHub sprint report example";
const intro = "See how three fictional commits from a campus scheduling project become an editable sprint recap.";

export function generateMetadata() {
  return pageMetadata("/examples/sprint-report", title, intro);
}

export default function SprintReportExample() {
  return <ResourcePage title={title} intro={intro}>
    <p><strong>Sample data.</strong> This repository and its commits are fictional.</p>
    <h2>Before: commit history</h2>
    <ul>
      <li><code>src/events/filters.ts</code> and <code>src/events/list.tsx</code> — Add event date filters</li>
      <li><code>tests/events.test.ts</code> — Cover date filter boundaries</li>
      <li><code>docs/calendar.md</code> — Document calendar setup</li>
    </ul>
    <h2>After: a short, reviewable recap</h2>
    <p><strong>Contribution.</strong> Updated the event list and its date-filtering code. Added test cases for the filter boundaries and documented calendar setup.</p>
    <p><strong>Blocker, added by the author.</strong> Waiting for timezone examples from the campus calendar team.</p>
    <p><strong>Next step, added by the author.</strong> Review those examples and add fixtures for imports around midnight.</p>
    <p>A real report links the generated statements to the corresponding GitHub SHAs. The author adds the blocker and next step. This sample shows how to edit the report without inventing source links.</p>
    <div className="example-actions"><ExampleButton/></div>
    <p>For more context, see <Link href="/guides/how-to-write-a-sprint-report">how to write a sprint report</Link>.</p>
  </ResourcePage>;
}
