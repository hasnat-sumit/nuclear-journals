import type { Metadata } from "next";
import Link from "next/link";
import { StaticPage } from "@/components/site/static-page";

export const metadata: Metadata = {
  title: "Reviewer Guidelines",
  description: "How reviewing works at Nuclear Journal.",
};

export default function ReviewerGuidelinesPage() {
  return (
    <StaticPage title="Reviewer Guidelines" intro="Reviewers help keep what we publish accurate and useful.">
      <h2>How to become a reviewer</h2>
      <ol>
        <li><Link href="/sign-up">Create an account</Link> and verify your email.</li>
        <li>Apply as a reviewer from your dashboard.</li>
        <li>Once approved, set your expertise and proficiency, topics to exclude, and workload.</li>
        <li>Turn on availability when you are ready. You will not be invited until you do.</li>
      </ol>
      <h2>Reviewing an article</h2>
      <p>
        Accept or decline each invitation. Please decline if you have a conflict of interest. Your reason is seen only by the editors, and the writer is never told.
      </p>
      <p>
        Score technical accuracy, clarity, relevance, references and overall quality from 1 to 5, then give constructive written feedback and a recommendation: accept, minor revision, major revision or reject.
      </p>
      <h2>Confidentiality</h2>
      <p>
        Treat every assigned article as confidential. Your recommendation goes to the editor, who decides the outcome and what feedback to release. Your name appears publicly only if you opt in to public recognition, and only on published articles you reviewed.
      </p>
    </StaticPage>
  );
}
