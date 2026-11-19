import Link from "next/link";
import { ResourcePage } from "../../../components/layout/resource-page";
import { pageMetadata } from "../../../lib/seo/site";

export const dynamic = "force-dynamic";

const title = "How to write a software engineering sprint report";
const intro = "A short sprint report connects the goal, your contribution, the evidence, and what the team should do next.";

export function generateMetadata() {
  return pageMetadata("/guides/how-to-write-a-sprint-report", title, intro);
}

export default function SprintReportGuide() {
  return <ResourcePage title={title} intro={intro}>
    <h2>Summarize the goal and the change</h2>
    <p>Start with a date range and the team’s goal. Group work by outcome so a reader can connect it to that goal. In a capstone scheduling project, for instance, “Added a date filter to the event list” is clearer than a bullet for each commit that adjusted the filter.</p>
    <h2>Give a reviewer a way to check the work</h2>
    <p>Link the commit or pull request behind each technical claim. Add separate links for test runs, design proposals, or reviews if those were part of your work. Name collaborators if the outcome was shared and describe your contribution precisely.</p>
    <h2>Write blockers and next steps yourself</h2>
    <p>A blocker should explain what stalled and what would unblock it. For example, “We need the campus calendar’s timezone rules before validating imports.” A next step should be concrete enough to pick up. For example, “Collect timezone examples and add import fixtures.”</p>
    <p>Use this <Link href="/examples/sprint-report">before-and-after sprint report</Link> as a model, or read how <Link href="/guides/github-contribution-report">GitHub commit attribution</Link> affects the evidence.</p>
  </ResourcePage>;
}
