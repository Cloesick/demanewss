import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { promises as fs } from 'fs';
import path from 'path';
import { writeFile } from 'fs/promises';

export const dynamic = 'force-dynamic';

interface PdfUpload {
  id: string;
  filename: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  uploadedBy: string;
  uploadedByEmail: string;
  uploadedAt: string;
  status: 'uploading' | 'compressing' | 'ready' | 'error';
  path: string;
  publicUrl: string;
  errorMessage?: string;
}

async function getUploadHistory(): Promise<PdfUpload[]> {
  try {
    const dataPath = path.join(process.cwd(), 'data', 'pdf-uploads.json');
    const fileContents = await fs.readFile(dataPath, 'utf8');
    return JSON.parse(fileContents);
  } catch (error) {
    // File doesn't exist yet, return empty array
    return [];
  }
}

async function saveUploadHistory(uploads: PdfUpload[]): Promise<void> {
  try {
    const dataDir = path.join(process.cwd(), 'data');
    await fs.mkdir(dataDir, { recursive: true });
    
    const dataPath = path.join(dataDir, 'pdf-uploads.json');
    await fs.writeFile(dataPath, JSON.stringify(uploads, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving upload history:', error);
  }
}

async function checkEmployeeVerification(email: string): Promise<boolean> {
  try {
    const dataPath = path.join(process.cwd(), 'data', 'employees.json');
    const fileContents = await fs.readFile(dataPath, 'utf8');
    const employees = JSON.parse(fileContents);
    
    const employee = employees.find(
      (emp: any) => emp.email === email && emp.verified && emp.active
    );
    
    return !!employee;
  } catch (error) {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized - Please log in first' },
        { status: 401 }
      );
    }

    // Check employee verification
    const isVerified = await checkEmployeeVerification(session.user.email);
    if (!isVerified) {
      return NextResponse.json(
        { 
          error: 'Not authorized',
          message: 'You must be a verified Dema employee to upload PDFs. Please verify your employee ID first.'
        },
        { status: 403 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const compressionLevel = formData.get('compressionLevel') as string || 'medium';

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.name.endsWith('.pdf')) {
      return NextResponse.json(
        { error: 'Only PDF files are allowed' },
        { status: 400 }
      );
    }

    // Validate file size (50MB max)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 50MB' },
        { status: 400 }
      );
    }

    // Generate unique ID
    const uploadId = `pdf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    // Save original file
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'pdfs');
    await fs.mkdir(uploadDir, { recursive: true });

    const originalFilename = file.name;
    const safeFilename = originalFilename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = path.join(uploadDir, `${uploadId}_${safeFilename}`);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    const originalSize = file.size;

    // Create upload record
    const upload: PdfUpload = {
      id: uploadId,
      filename: originalFilename,
      originalSize: originalSize,
      compressedSize: originalSize, // Will be updated after compression
      compressionRatio: 0,
      uploadedBy: session.user.name || 'Unknown',
      uploadedByEmail: session.user.email,
      uploadedAt: timestamp,
      status: 'ready', // For now, mark as ready (compression can be added later)
      path: filePath,
      publicUrl: `/uploads/pdfs/${uploadId}_${safeFilename}`
    };

    // Save to history
    const history = await getUploadHistory();
    history.unshift(upload); // Add to beginning
    await saveUploadHistory(history);

    return NextResponse.json({
      success: true,
      upload: {
        id: upload.id,
        filename: upload.filename,
        originalSize: upload.originalSize,
        compressedSize: upload.compressedSize,
        compressionRatio: upload.compressionRatio,
        status: upload.status,
        publicUrl: upload.publicUrl,
        uploadedAt: upload.uploadedAt
      },
      message: 'PDF uploaded successfully!'
    });

  } catch (error) {
    console.error('Error uploading PDF:', error);
    return NextResponse.json(
      { error: 'Failed to upload PDF', details: String(error) },
      { status: 500 }
    );
  }
}

// GET endpoint to fetch upload history
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const history = await getUploadHistory();
    
    // Filter by user's email or show all if admin
    const userEmail = session.user.email;
    const isAdmin = (session.user as any)?.role === 'admin';

    const userUploads = isAdmin 
      ? history 
      : history.filter(upload => upload.uploadedByEmail === userEmail);

    return NextResponse.json({
      uploads: userUploads
    });

  } catch (error) {
    console.error('Error fetching uploads:', error);
    return NextResponse.json(
      { error: 'Failed to fetch uploads' },
      { status: 500 }
    );
  }
}
