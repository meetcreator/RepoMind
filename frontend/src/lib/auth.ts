import GithubProvider from "next-auth/providers/github";
import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions } from "next-auth";

const isDev =
  process.env.NODE_ENV === "development" ||
  !process.env.GITHUB_CLIENT_ID ||
  process.env.GITHUB_CLIENT_ID === "your_github_client_id_here";

export const authOptions: NextAuthOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
      authorization: {
        params: { scope: "read:user repo" },
      },
    }),
    // Dev-bypass: lets you sign in without a real GitHub OAuth App
    ...(isDev
      ? [
          CredentialsProvider({
            id: "dev-login",
            name: "Dev Login",
            credentials: {},
            async authorize() {
              return {
                id: "dev-user-1",
                name: "Dev User",
                email: "dev@repomind.local",
                image: "https://avatars.githubusercontent.com/u/0",
              };
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
};

