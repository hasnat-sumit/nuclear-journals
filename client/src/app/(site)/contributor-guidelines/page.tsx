import type { Metadata } from "next";
import Link from "next/link";
import { StaticPage } from "@/components/site/static-page";

export const metadata: Metadata = {
  title: "Contributor Guidelines",
  description: "How to write for Nuclear Journal.",
};

export default function ContributorGuidelinesPage() {
  return (
    <StaticPage title="Contributor Guidelines" intro="We welcome clear, accurate technical and educational writing.">
      <h2>How to become a writer</h2>
      <ol>
        <li><Link href="/sign-up">Create an account</Link> and verify your email.</li>
        <li>Apply as a writer from your dashboard, telling us about your background.</li>
        <li>Start writing once an editor approves your application.</li>
      </ol>
      <h2>What makes a good article</h2>
      <ul>
        <li>A clear purpose and a defined audience</li>
        <li>Accurate content, with references for important claims</li>
        <li>Plain language wherever possible, with technical terms explained</li>
        <li>Original work that you have the right to publish</li>
      </ul>
      <h2>What every submission must confirm</h2>
      <ul>
        <li><strong>Authorship:</strong> you are the author of this article.</li>
        <li><strong>Originality:</strong> the work is original and properly cited.</li>
        <li><strong>Confidentiality:</strong> it contains no classified, restricted, proprietary or sensitive operational nuclear facility information.</li>
      </ul>
      <h2>After you submit</h2>
      <p>
        Your article shows as Pending Review while the editorial team works on it. You will hear back with one official decision: approved, revision requested, or rejected, together with any feedback from the editor.
      </p>
    </StaticPage>
  );
}
