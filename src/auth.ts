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
        // This is a simple example - replace with your actual authentication logic
        // For development, we'll accept any email/password combination
        // In production, you should verify against a database
        
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Example: Accept any valid email for testing
        // TODO: Replace with real database authentication
        const email = credentials.email.toLowerCase();
        
        // Check if admin (demashop.be domain or specific gmail)
        const isDemashopDomain = email.endsWith('@demashop.be');
        const isAliasAdmin = email === 'nicolas.cloet@gmail.com';
        const role = (isDemashopDomain || isAliasAdmin) ? 'admin' : 'user';
        const aliasEmail = isAliasAdmin ? 'nicolas@demashop.be' : email;

        // For testing, accept any email with password length > 0
        // In production, verify password hash from database
        if (credentials.password.length > 0) {
          return {
            id: email,
            email: email,
            name: email.split('@')[0],
            role: role,
            aliasEmail: aliasEmail,
          };
        }

        return null;
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
      // Determine admin role based on email domain or explicit mapping
      const email = (profile as any)?.email || token.email || '';
      const emailLower = String(email).toLowerCase();
      const isDemashopDomain = emailLower.endsWith('@demashop.be');
      const isAliasAdmin = emailLower === 'nicolas.cloet@gmail.com';
      const aliasEmail = isAliasAdmin ? 'nicolas@demashop.be' : emailLower;
      const role = (isDemashopDomain || isAliasAdmin) ? 'admin' : 'user';
      token.role = role;
      token.aliasEmail = aliasEmail;
      return token;
    },
  },
};
