'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import the PDF viewer to avoid SSR issues
const PDFViewerWithHighlight = dynamic(
  () => import('@/components/PDFViewerWithHighlight'),
  { ssr: false }
);

function PDFViewerContent() {
  const searchParams = useSearchParams();
  const pdfFile = searchParams.get('file') || searchParams.get('pdf');
  const page = searchParams.get('page');
  const sku = searchParams.get('sku');

  if (!pdfFile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">No PDF specified</h1>
          <p className="text-gray-600">Please provide a PDF file to view.</p>
        </div>
      </div>
    );
  }

  const pdfUrl = (() => {
    const s = String(pdfFile || '').trim();
    if (!s) return '';
    if (s.startsWith('http://') || s.startsWith('https://')) return s;
    if (s.startsWith('/')) return s;
    return `/documents/${s}`;
  })();
  const pageNum = page ? parseInt(page, 10) : 1;
  const fileName = (() => {
    const s = String(pdfFile || '').trim();
    if (!s) return '';
    try {
      const u = new URL(s);
      return decodeURIComponent(u.pathname.split('/').pop() || s);
    } catch {
      const p = s.split('?')[0];
      return decodeURIComponent(p.split('/').pop() || s);
    }
  })();

  return (
    <PDFViewerWithHighlight
      pdfUrl={pdfUrl}
      page={pageNum}
      searchTerm={sku || undefined}
      fileName={fileName}
    />
  );
}

export default function PDFViewerPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading PDF...</p>
        </div>
      </div>
    }>
      <PDFViewerContent />
    </Suspense>
  );
}
