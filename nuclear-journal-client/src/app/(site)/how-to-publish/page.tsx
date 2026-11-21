import type { Metadata } from "next";
import Link from "next/link";
import { StaticPage } from "@/components/site/static-page";

export const metadata: Metadata = {
  title: "How to Publish",
  description: "Learn how to submit an article to Nuclear Journal and what happens during editorial review.",
};

export default function HowToPublishPage() {
  return (
    <StaticPage
      title="How to Publish"
      intro="Nuclear Journal articles move through writer approval, editorial screening and expert review before publication. Editors make the final publication decision."
    >
      <h2>1. Become an approved writer</h2>
      <p>
        <Link href="/sign-up">Create an account</Link>, verify your email, and apply as a writer from your dashboard. An editor reviews your application. You can start a submission after your writer application is approved. See our <Link href="/contributor-guidelines">contributor guidelines</Link> for the writing standards and submission requirements.
      </p>

      <h2>2. Prepare your article</h2>
      <p>
        Write for a clear audience and purpose. Support important claims with reliable references, explain technical terms, and submit original work that you have the right to publish. Do not include classified, restricted, proprietary or sensitive operational nuclear facility information.
      </p>

      <h2>3. Submit for editorial screening</h2>
      <p>
        Submit your article from your writer dashboard. It will appear as Pending Review while an editor checks its scope, quality, references and sensitive content. The editor may send it for expert review or decide that it is not suitable to proceed.
      </p>

      <h2>4. Expert review</h2>
      <p>
        An editor may assign the article to one or more reviewers with relevant expertise. Reviewers evaluate the article and provide feedback and a recommendation. Reviewer advice helps inform the decision, but reviewers do not approve or reject submissions.
      </p>

      <h2>5. Receive the editor&apos;s decision</h2>
      <p>
        The editor sends one official decision: approved, revision requested, or rejected. If revisions are requested, use the feedback to update your article and resubmit it for further consideration. The editor makes the final decision after reviewing the submission and any revisions.
      </p>

      <h2>6. Publication</h2>
      <p>
        Approved articles are prepared for publication and made available for everyone to read. For more detail about review, confidentiality and editorial decisions, read our <Link href="/editorial-policy">editorial policy</Link>.
      </p>
    </StaticPage>
  );
}
