import { redirect } from "next/navigation";
import { auth } from "@/auth";

// Root route is the front door: signed-in users go straight to the
// community feed (the heart of the product); everyone else gets the
// login page (?mode=create opens registration first).
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth();
  if (session?.user?.id) {
    redirect("/community");
  }
  redirect("/auth/signin?mode=create");
}
