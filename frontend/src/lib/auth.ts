import GithubProvider from "next-auth/providers/github";
import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions } from "next-auth";

const githubClientId = process.env.GITHUB_CLIENT_ID;
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;
const hasGitHubCredentials = Boolean(
  githubClientId &&
    githubClientSecret &&
    githubClientId !== "your_github_client_id_here" &&
    githubClientSecret !== "your_github_client_secret_here",
);
const isDevelopment = process.env.NODE_ENV === "development";

export const authOptions: NextAuthOptions = {
  providers: [
    ...(hasGitHubCredentials
      ? [
          GithubProvider({
            clientId: githubClientId!,
            clientSecret: githubClientSecret!,
            authorization: {
              params: { scope: "read:user repo" },
            },
          }),
        ]
      : []),
    // Dev-bypass is deliberately restricted to local development.
    ...(isDevelopment
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
