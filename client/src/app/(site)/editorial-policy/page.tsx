import type { Metadata } from "next";
import { StaticPage } from "@/components/site/static-page";

export const metadata: Metadata = {
  title: "Editorial Policy",
  description: "How articles are reviewed, decided and published at Nuclear Journal.",
};

export default function EditorialPolicyPage() {
  return (
    <StaticPage title="Editorial Policy" intro="How an article moves from submission to publication.">
      <h2>Review and decisions</h2>
      <p>
        Submissions are screened by an editor and may be sent to one or more reviewers with relevant expertise. Reviewers provide structured feedback and a recommendation. That recommendation is advisory: the editor makes every final decision.
      </p>
      <h2>Confidentiality</h2>
      <p>
        The review process is confidential. Writers receive the official decision and the feedback released by the editor. Reviewer identities are not shared during review. A reviewer may be credited on a published article only if they choose public recognition.
      </p>
      <h2>Responsible content</h2>
      <p>
        We do not publish classified, restricted or proprietary material, or sensitive operational information about nuclear facilities. Contributors confirm this when submitting, and editors check it during screening.
      </p>
      <h2>Conflicts of interest</h2>
      <p>
        Reviewers are not assigned to their own work, and can decline any article where they have a conflict of interest.
      </p>
      <h2>Comments and ratings</h2>
      <p>
        Comments are moderated before they appear. Ratings are for reader feedback only and never influence editorial decisions or reviewer assignment.
      </p>
      <h2>Corrections</h2>
      <p>
        If you believe a published article contains an error, please tell us through the contact page. Editors can correct, unpublish or archive articles.
      </p>
    </StaticPage>
  );
}
