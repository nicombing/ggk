import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const type = formData.get('type') as string; // 'design' or 'payment'

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Ensure uploads directory exists
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    try {
      await fs.access(uploadsDir);
    } catch {
      await fs.mkdir(uploadsDir, { recursive: true });
    }

    // Sanitize filename
    const ext = path.extname(file.name);
    const base = path.basename(file.name, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const timestamp = Date.now();
    const safeName = `${base}_${timestamp}${ext}`;
    const filePath = path.join(uploadsDir, safeName);
    const publicUrl = `/uploads/${safeName}`;

    await fs.writeFile(filePath, buffer);

    // If it's a CDR file, convert it
    if (ext.toLowerCase() === '.cdr') {
      const convertedName = `${base}_${timestamp}_converted.png`;
      const convertedPath = path.join(uploadsDir, convertedName);
      const convertedUrl = `/uploads/${convertedName}`;

      try {
        // Run inkscape CLI to get PNG
        const cmd = `"${path.join('C:', 'Program Files', 'Inkscape', 'bin', 'inkscape.com')}" --export-filename="${convertedPath}" "${filePath}"`;
        await execAsync(cmd);
        
        // Run inkscape CLI to get SVG for font extraction
        const svgName = `${base}_${timestamp}.svg`;
        const svgPath = path.join(uploadsDir, svgName);
        const fontCmd = `"${path.join('C:', 'Program Files', 'Inkscape', 'bin', 'inkscape.com')}" --export-plain-svg="${svgPath}" "${filePath}"`;
        let appliedFonts: string[] = [];
        try {
          await execAsync(fontCmd);
          const svgContent = await fs.readFile(svgPath, 'utf8');
          const matches = svgContent.matchAll(/font-family\s*[:=]\s*["']?([^"';]+)["']?/g);
          const fontSet = new Set<string>();
          for (const match of matches) {
            const fontName = match[1].split(',')[0].replace(/['"]/g, '').trim();
            if (fontName && !['sans-serif', 'serif', 'monospace'].includes(fontName.toLowerCase())) {
              fontSet.add(fontName);
            }
          }
          appliedFonts = Array.from(fontSet);
          await fs.unlink(svgPath).catch(() => {});
        } catch (fontErr) {
          console.error("Failed to extract fonts:", fontErr);
        }

        // Get file size
        const stats = await fs.stat(convertedPath);
        const fileSizeMb = (stats.size / (1024 * 1024)).toFixed(2);

        return NextResponse.json({
          originalUrl: publicUrl,
          convertedUrl: convertedUrl,
          fileSizeMb: Number(fileSizeMb),
          appliedFonts: appliedFonts,
          success: true
        }, { headers: getCorsHeaders() });
      } catch (convErr: any) {
        console.error("Conversion error:", convErr);
        return NextResponse.json({ error: `Conversion failed: ${convErr.message}` }, { status: 500, headers: getCorsHeaders() });
      }
    }

    return NextResponse.json({
      originalUrl: publicUrl,
      success: true
    }, { headers: getCorsHeaders() });

  } catch (error: any) {
    console.error("Upload Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: getCorsHeaders() });
  }
}

function getCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Bypass-Tunnel-Reminder, ngrok-skip-browser-warning",
  };
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(),
  });
}
