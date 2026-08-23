import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      provider?: string;
      role?: string;
      theme?: string;
      accent?: string;
      background?: string;
      isCreator?: boolean;
    } & DefaultSession["user"];
  }
  interface User {
    provider?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    provider?: string;
    theme?: string;
    accent?: string;
    background?: string;
  }
}

