import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { getClient, setLastSent } from '@/lib/marketingStore';
import { getProducts } from '@/lib/products';

export async function POST(request: Request) {
  try {
    // Auth: this triggers an outbound email — require an admin session, or a
    // server-side secret for automated/cron callers. (Was previously open to anyone.)
    const secret = process.env.MARKETING_API_SECRET;
    const authHeader = request.headers.get('authorization') || '';
    const hasValidSecret = !!secret && authHeader === `Bearer ${secret}`;
    if (!hasValidSecret) {
      const session = await getServerSession(authOptions);
      if ((session?.user as any)?.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const body = await request.json();
    const clientId = String(body.clientId || '').trim();
    if (!clientId) return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      return NextResponse.json({ error: 'Missing RESEND_API_KEY' }, { status: 500 });
    }

    const c = getClient(clientId);
    if (!c || !c.email || !c.consent) {
      return NextResponse.json({ error: 'User not consented or no email' }, { status: 400 });
    }

    // Build suggestions similar to suggestions endpoint
    const all = await getProducts();
    const terms = Array.isArray(c.searches) ? c.searches.slice(-5) : [];
    const textScore = (p: any) => {
      const t = `${(p.sku||'').toLowerCase()} ${(p.name||'').toLowerCase()} ${(p.description||'').toLowerCase()} ${(p.product_category||'').toLowerCase()}`;
      let s = 0;
      for (const q of terms) {
        if (t.includes(q)) s += 5;
      }
      s += (p.rating||0) * 0.5 + (p.inStock ? 1 : 0);
      return s;
    };
    const items = [...all]
      .map(p => ({ p, s: textScore(p) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 6)
      .map(x => x.p);

    const subject = 'Jouw gepersonaliseerde product hoogtepunten';
    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.5">
        <h2>Product hoogtepunten op basis van je recente zoekopdrachten</h2>
        <p>We kozen enkele producten die passen bij je interesse.</p>
        <ul>
          ${items.map((it: any) => `<li style="margin:8px 0"><a href="${process.env.NEXT_PUBLIC_BASE_URL || ''}/products/${it.sku}" style="color:#0ea5e9;text-decoration:none">${it.name || it.sku}</a> — <span style="color:#555">${it.product_category || ''}</span></li>`).join('')}
        </ul>
        <p style="margin-top:16px">Je ontvangt deze mail omdat je marketingcommunicatie toestond in je profielinstellingen.</p>
      </div>
    `;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'DemaShop <noreply@demashop.be>',
        to: [c.email],
        subject,
        html,
      })
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: 'Resend failed', details: err }, { status: 500 });
    }

    setLastSent(clientId);
    return NextResponse.json({ ok: true, sent: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 });
  }
}
