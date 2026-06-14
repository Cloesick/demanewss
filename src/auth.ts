import type { NextAuthOptions } from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    // Credentials provider for email/password login
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }
        const email = credentials.email.toLowerCase();

        // SECURITY: credentials login is gated behind explicit env configuration so an
        // arbitrary email/password can never authenticate (prevents anonymous access).
        // Enable it by setting CREDENTIALS_LOGIN_EMAIL + CREDENTIALS_LOGIN_PASSWORD, or
        // ALLOW_DEV_CREDENTIALS=true for a dev-only bypass (never honored in production).
        const allowedEmail = process.env.CREDENTIALS_LOGIN_EMAIL?.toLowerCase();
        const allowedPassword = process.env.CREDENTIALS_LOGIN_PASSWORD;
        const devBypass =
          process.env.NODE_ENV !== 'production' &&
          process.env.ALLOW_DEV_CREDENTIALS === 'true';

        let authenticated = false;
        if (allowedEmail && allowedPassword) {
          authenticated = email === allowedEmail && credentials.password === allowedPassword;
        } else if (devBypass) {
          authenticated = credentials.password.length > 0;
        }
        if (!authenticated) {
          return null;
        }

        // Role comes from a server-side allowlist (ADMIN_EMAILS), never the client email alone.
        const adminEmails = (process.env.ADMIN_EMAILS || '')
          .split(',')
          .map((e) => e.trim().toLowerCase())
          .filter(Boolean);
        const role = adminEmails.includes(email) ? 'admin' : 'user';

        return {
          id: email,
          email,
          name: email.split('@')[0],
          role,
          aliasEmail: email,
        };
      }
    }),

    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  pages: {
    signIn: '/login', // Custom login page
  },
  callbacks: {
    // Note: 'authorized' callback removed - not compatible with current Next Auth version
    // Use middleware for route protection instead
    async session({ session, token }) {
      // propagate role to session
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).aliasEmail = token.aliasEmail;
      }
      return session;
    },
    async jwt({ token, account, profile }) {
      // Admin role from a server-side allowlist (ADMIN_EMAILS). For Google OAuth the
      // email is provider-verified; a verified @demashop.be domain also grants admin.
      const email = (profile as any)?.email || token.email || '';
      const emailLower = String(email).toLowerCase();
      const adminEmails = (process.env.ADMIN_EMAILS || '')
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
      const isAdminAllowlisted = adminEmails.includes(emailLower);
      const isDemashopDomain = emailLower.endsWith('@demashop.be');
      const role = isAdminAllowlisted || isDemashopDomain ? 'admin' : 'user';
      token.role = role;
      token.aliasEmail = emailLower;
      return token;
    },
  },
};
