import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Landing } from "@/components/Landing";

// Root route. Signed-out visitors get the landing page; signed-in users
// go straight to the community feed (the heart of the product).
export default async function HomePage() {
  const session = await auth();
  if (session?.user?.id) {
    redirect("/community");
  }
  return <Landing />;
}
