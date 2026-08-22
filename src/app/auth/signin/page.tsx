import { SignInForm } from "./SignInForm";

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

export default function SignInPage() {
  return <SignInForm oauthProviders={enabledOAuthProviders()} />;
}
