import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';
import { ImageModel } from '@/lib/models';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type (images only)
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Only image files are allowed' },
        { status: 400 }
      );
    }

    // Generate unique filename
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const hash = crypto.createHash('md5').update(buffer).digest('hex');
    const ext = path.extname(file.name);
    const filename = `${hash}${ext}`;
    const filepath = path.join(process.cwd(), 'public', 'uploads', filename);

    // Save file
    await writeFile(filepath, buffer);

    // Save to database
    const image = ImageModel.create({
      filename: file.name,
      filepath: `/uploads/${filename}`,
      mime_type: file.type,
      size: file.size,
    });

    return NextResponse.json({
      success: true,
      image,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}
