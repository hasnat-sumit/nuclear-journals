// Fills a local database with categories, demo accounts and sample articles.
// Safe to run repeatedly. Categories can also be seeded in production with
// `--categories-only`; demo accounts never can.
import { connectDatabase, disconnectDatabase } from "../src/config/database.js";
import { env } from "../src/config/env.js";
import { getAuth } from "../src/lib/auth.js";
import { readingTimeMinutes, toPlainText } from "../src/lib/content.js";
import { toSlug } from "../src/lib/http.js";
import { Article } from "../src/models/article.model.js";
import { Category } from "../src/models/category.model.js";
import { ReviewerProfile } from "../src/models/reviewer-profile.model.js";
import { User } from "../src/models/user.model.js";

const CATEGORIES = [
  ["Nuclear Engineering", "Design, construction and operation of nuclear systems."],
  ["Nuclear Safety", "Principles and practice that keep people and the environment safe."],
  ["Radiation Protection", "Measuring, limiting and managing radiation exposure."],
  ["Nuclear Reactor Physics", "Neutronics, criticality and reactor behaviour."],
  ["Nuclear Energy", "The role of nuclear power in energy systems."],
  ["Nuclear Materials", "Fuels, cladding and materials under irradiation."],
  ["Thermal Hydraulics", "Heat transfer and fluid flow in reactors."],
  ["Nuclear Instrumentation", "Detectors, measurement and control."],
  ["Nuclear Waste Management", "Handling, storage and disposal of radioactive waste."],
  ["Environmental Radiation", "Natural and artificial radiation in the environment."],
  ["Nuclear Policy", "Regulation, governance and public decision-making."],
  ["Energy Economics", "Costs, markets and investment in energy."],
  ["Education and Training", "Building knowledge and skills across the field."],
];

const DEMO_PASSWORD = "Demo-Password-2026";

await connectDatabase();

await Promise.all(
  CATEGORIES.map(([name, description], displayOrder) =>
    Category.updateOne(
      { slug: toSlug(name!) },
      { $set: { name, description, displayOrder, isActive: true } },
      { upsert: true },
    ),
  ),
);
console.log(`Seeded ${CATEGORIES.length} categories.`);

if (process.argv.includes("--categories-only")) {
  await disconnectDatabase();
  process.exit(0);
}

if (env.NODE_ENV === "production") {
  console.error("Refusing to create demo accounts in production.");
  await disconnectDatabase();
  process.exit(1);
}

async function demoUser(name: string, email: string, role: string, bio: string) {
  const existing = await User.findOne({ email });
  if (!existing) {
    await getAuth().api.signUpEmail({ body: { name, email, password: DEMO_PASSWORD } });
  }
  await User.updateOne({ email }, { $set: { role, bio, emailVerified: true } });
  const user = await User.findOne({ email }).select("_id").lean();
  return user!._id;
}

await demoUser("Editor Demo", "editor@nuclearjournal.example", "editor", "Demo editorial account.");
const writer = await demoUser(
  "Dr. Writer Demo",
  "writer@nuclearjournal.example",
  "writer",
  "Demo contributor. This is sample content for local development.",
);
const reviewer = await demoUser("Reviewer Demo", "reviewer@nuclearjournal.example", "reviewer", "Demo reviewer account.");
await demoUser("Reader Demo", "reader@nuclearjournal.example", "reader", "");

const bySlug = new Map((await Category.find().lean()).map((category) => [category.slug, category._id]));

await ReviewerProfile.updateOne(
  { user: reviewer },
  {
    $set: {
      availability: "available",
      expertise: [
        { category: bySlug.get("nuclear-safety"), proficiency: "expert" },
        { category: bySlug.get("radiation-protection"), proficiency: "advanced" },
      ],
    },
  },
  { upsert: true },
);

const ARTICLES = [
  {
    title: "Understanding Defence in Depth",
    headings: ["The core idea", "Preventing and controlling problems", "Limiting consequences"],
    category: "nuclear-safety",
    featured: true,
    excerpt: "How layered, independent safety provisions protect people even when individual barriers fail.",
    tags: ["safety", "fundamentals"],
    paragraphs: [
      "Defence in depth is the central organising idea of nuclear safety. Rather than relying on any single protective measure, it arranges several independent levels of protection, so that a failure at one level is compensated for by the next.",
      "The first levels aim to prevent abnormal operation through conservative design, quality construction and careful operation. If those are challenged, control systems return the plant to normal conditions, and engineered safety features act if an accident begins.",
      "Later levels limit the consequences of more severe conditions, including off-site emergency planning. The value of the approach comes from independence: the levels should not share common weaknesses that could defeat several of them at once.",
    ],
  },
  {
    title: "Half-Life, Explained Without the Maths",
    headings: ["What half-life means", "A common misunderstanding", "Why dose matters more"],
    category: "radiation-protection",
    excerpt: "A plain-language guide to what half-life means, and what it does not mean for safety.",
    tags: ["radiation", "education"],
    paragraphs: [
      "Half-life is the time it takes for half of the atoms in a radioactive sample to decay. It is a statistical property of the population of atoms: no one can say when an individual atom will decay, but the behaviour of a large group is highly predictable.",
      "A common misunderstanding is that a long half-life makes a material more dangerous. In fact, for the same number of atoms, a shorter half-life means more decays each second. Hazard also depends on the type of radiation, the amount of material and the route of exposure.",
      "This is why radiation protection looks at activity and dose, not half-life alone. Half-life tells us how the activity changes over time, which matters for storage, shielding and planning.",
    ],
  },
  {
    title: "Why Reactor Coolant Matters",
    headings: ["Removing heat", "Decay heat after shutdown", "Choosing a coolant"],
    category: "thermal-hydraulics",
    excerpt: "An introduction to how heat leaves the fuel, and why that shapes reactor design.",
    tags: ["coolant", "fundamentals"],
    paragraphs: [
      "Every reactor design is shaped by a simple requirement: heat generated in the fuel must be removed reliably, both during operation and after shutdown. The coolant carries that heat away and, in many designs, also moderates neutrons.",
      "Because radioactive decay continues after a reactor shuts down, cooling cannot simply stop when power generation stops. Decay heat falls quickly but remains significant for a long time, which is why cooling systems receive so much attention in safety analysis.",
      "Different coolants bring different trade-offs in pressure, temperature, chemistry and material compatibility. Understanding those trade-offs is a good first step towards understanding why reactor designs differ.",
    ],
  },
  {
    title: "How Radiation Is Measured",
    category: "nuclear-instrumentation",
    headings: ["Counting what we cannot see", "Activity and dose", "Choosing the right instrument"],
    excerpt: "From becquerels to sieverts: the units and instruments behind radiation measurements.",
    tags: ["instrumentation", "education"],
    paragraphs: [
      "Radiation cannot be seen, heard or felt, so everything we know about it in practice comes from instruments. Detectors work by recording the small electrical or light signals produced when radiation interacts with a material inside them.",
      "Two families of units appear again and again. Activity, measured in becquerels, describes how many atoms in a source decay each second. Dose, measured in grays and sieverts, describes the energy deposited in a body and its likely biological effect.",
      "Different detectors suit different jobs. Gas-filled counters are simple and robust for surveys, scintillators are sensitive and can identify isotopes, and personal dosimeters record what an individual worker receives over time.",
    ],
  },
];

const now = Date.now();
for (const [index, item] of ARTICLES.entries()) {
  const html = item.paragraphs.map((text, i) => `<h2>${item.headings[i]}</h2><p>${text}</p>`).join("");
  const plainText = toPlainText(html);
  await Article.updateOne(
    { slug: toSlug(item.title) },
    {
      $set: {
        title: item.title,
        excerpt: item.excerpt,
        content: {
          json: {
            type: "doc",
            content: item.paragraphs.flatMap((text, i) => [
              { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: item.headings[i] }] },
              { type: "paragraph", content: [{ type: "text", text }] },
            ]),
          },
          html,
        },
        plainText,
        author: writer,
        category: bySlug.get(item.category),
        tags: item.tags,
        references: [{ citation: "Sample reference for demonstration content." }],
        declarations: { author: true, originality: true, confidentiality: true, confirmedAt: new Date() },
        status: "published",
        featured: Boolean(item.featured),
        readingTime: readingTimeMinutes(plainText),
        publishedAt: new Date(now - index * 86_400_000),
      },
    },
    { upsert: true },
  );
}
console.log(`Seeded ${ARTICLES.length} sample articles.`);
console.log(`Demo accounts: editor@, writer@, reviewer@, reader@nuclearjournal.example`);
console.log(`Demo password: ${DEMO_PASSWORD}`);

await disconnectDatabase();
process.exit(0);
