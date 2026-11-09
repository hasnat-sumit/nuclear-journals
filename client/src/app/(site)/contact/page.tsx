import type { Metadata } from "next";
import { StaticPage } from "@/components/site/static-page";

export const metadata: Metadata = {
  title: "Contact",
  description: "How to contact the Nuclear Journal editorial team.",
};

const CONTACT_EMAIL = process.env.CONTACT_EMAIL ?? "editors@nuclearjournal.example";

export default function ContactPage() {
  return (
    <StaticPage title="Contact" intro="We would like to hear from you.">
      <p>
        For editorial questions, corrections or contributor enquiries, email{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
      <p>
        If you are reporting an error in an article, please include its title and the passage concerned.
      </p>
    </StaticPage>
  );
}
