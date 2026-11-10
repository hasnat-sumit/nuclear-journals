// Editors are privileged, so no API route creates them. This is how the first one
// is made: register normally on the website, then run:
//   npm run make-editor -w server -- person@example.com
import { connectDatabase, disconnectDatabase } from "../src/config/database.js";
import { User } from "../src/models/user.model.js";

const email = process.argv[2];
if (!email) {
  console.error("Usage: npm run make-editor -w server -- person@example.com");
  process.exit(1);
}

await connectDatabase();
const { matchedCount } = await User.updateOne({ email: email.toLowerCase() }, { $set: { role: "editor" } });
console.log(matchedCount === 1 ? `${email} is now an editor.` : `No account found for ${email}.`);
await disconnectDatabase();
process.exit(matchedCount === 1 ? 0 : 1);
