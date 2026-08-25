import { Suspense } from "react";
import { SignInForm } from "./SignInForm";
import { getTopTags } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata = { title: "Sign in", robots: { index: false } };

// Only OAuth providers with credentials in env are offered — clicking an
// unconfigured provider would error at runtime. Demo credentials login is
// always available (the credentials provider is always registered).
function enabledOAuthProviders(): string[] {
  const ids: string[] = [];
  if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) ids.push("github");
  if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) ids.push("google");
  if (process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET) ids.push("facebook");
  if (process.env.AUTH_MICROSOFT_ENTRA_ID && process.env.AUTH_MICROSOFT_ENTRA_SECRET)
    ids.push("microsoft-entra-id");
  if (process.env.AUTH_YAHOO_ID && process.env.AUTH_YAHOO_SECRET) ids.push("yahoo");
  return ids;
}

export default async function SignInPage() {
  // Live tag suggestions feed the stepper's interests step.
  let suggestions: string[] = [];
  try {
    suggestions = (await getTopTags(24)).map(([t]) => t);
  } catch {
    /* cold DB — empty suggestions are fine */
  }
  // Suspense boundary required: SignInForm reads useSearchParams() to show
  // friendly denial states for ?error=CredentialsSignin / Configuration.
  return (
    <Suspense>
      <SignInForm
        oauthProviders={enabledOAuthProviders()}
        suggestions={suggestions}
      />
    </Suspense>
  );
}
