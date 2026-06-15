import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';

export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { email, confirmation } = body;

    // Verify confirmation text
    if (confirmation !== 'DELETE MY ACCOUNT') {
      return NextResponse.json(
        { error: 'Invalid confirmation text' },
        { status: 400 }
      );
    }

    // Verify email matches session
    if (email !== session.user.email) {
      return NextResponse.json(
        { error: 'Email mismatch' },
        { status: 400 }
      );
    }

    const userEmail = session.user.email;

    // GDPR: do NOT report success when no deletion actually happens. There is no
    // user store wired yet, so we record the erasure request for manual processing
    // and tell the user honestly that it is pending. When a DB is connected, replace
    // this with a real transactional delete of user + orders/quotes/addresses/sessions
    // and a confirmation email.
    console.warn(`[ACCOUNT-DELETE] Erasure request received for ${userEmail} — manual processing required (no user store configured).`);

    return NextResponse.json(
      {
        error: 'Account deletion is not yet automated. Your erasure request has been recorded and will be processed manually.',
        status: 'pending',
      },
      { status: 501 }
    );

  } catch (error) {
    console.error('Account deletion error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
