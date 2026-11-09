import type { Metadata } from "next";
import { StaticPage } from "@/components/site/static-page";

export const metadata: Metadata = {
  title: "About",
  description: "Why Nuclear Journal exists and how it works.",
};

export default function AboutPage() {
  return (
    <StaticPage title="About Nuclear Journal" intro="Making reliable nuclear knowledge accessible to anyone who wants to learn.">
      <p>
        Nuclear Journal is an educational, knowledge-sharing editorial platform covering nuclear science, nuclear engineering, nuclear energy, radiation protection, nuclear safety and related technical fields.
      </p>
      <p>
        We publish for students, engineers, researchers, professionals and interested readers. Every article is free to read, and no account is needed.
      </p>
      <h2>What we are, and are not</h2>
      <p>
        We are an editorial publication, not a formal academic peer-reviewed journal. Articles are reviewed for accuracy and clarity, but they are not a substitute for primary literature, regulatory guidance or professional advice.
      </p>
      <h2>Our principles</h2>
      <ul>
        <li>Accuracy and technical quality</li>
        <li>Responsible sharing of nuclear knowledge</li>
        <li>Editorial independence</li>
        <li>Confidentiality of the review process</li>
        <li>Transparency of published content</li>
      </ul>
    </StaticPage>
  );
}
