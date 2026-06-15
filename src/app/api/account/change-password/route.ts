import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { currentPassword, newPassword, email } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Current password and new password are required' },
        { status: 400 }
      );
    }

    // Validate password strength
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'New password must be at least 8 characters' },
        { status: 400 }
      );
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: 'New password must be different from current password' },
        { status: 400 }
      );
    }

    // No credential backend is wired yet. Previously this used hardcoded mock
    // passwords (a security risk) and did not persist. Until a real user store
    // with bcrypt password hashing is connected, report honestly instead of
    // faking success. Wire up:
    //   const user = await db.user.findUnique({ where: { email: session.user.email } });
    //   const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    //   await db.user.update({ ... data: { passwordHash: await bcrypt.hash(newPassword, 10) } });
    return NextResponse.json(
      { error: 'Password change is not available yet (no credential backend configured).' },
      { status: 501 }
    );

  } catch (error) {
    console.error('Password change error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
