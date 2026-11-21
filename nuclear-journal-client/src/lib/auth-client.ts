import { createAuthClient } from "better-auth/react";

// Better Auth's own browser client. Requests use this website's address, which
// forwards them to the Express API.
export const authClient = createAuthClient({
  basePath: "/api/v1/auth",
});
