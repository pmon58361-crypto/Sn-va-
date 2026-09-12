import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { sanitizeRef } from "@/lib/referral";

// Root route is the front door: signed-in users go straight to the
// community feed (the heart of the product); everyone else gets the
// login page (?mode=create opens registration first).
export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const session = await auth();
  if (session?.user?.id) {
    redirect("/community");
  }
  // Forward ?ref= explicitly: the middleware cookie already captured it,
  // but cookie-blocked browsers still attribute via the param at signup.
  const { ref } = await searchParams;
  const clean = sanitizeRef(ref);
  redirect(`/auth/signin?mode=create${clean ? `&ref=${clean}` : ""}`);
}
