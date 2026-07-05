import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const filePath = path.join(process.cwd(), 'messages/vi/vi.json');
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    try {
      JSON.parse(text);
      return NextResponse.json({ ok: true });
    } catch(e: any) {
      // Find the issue by parsing line by line? No, JSON can't be parsed line by line.
      // Let's use eval to see if it gives a better error.
      let evalErr = '';
      try {
        eval('(' + text + ')');
      } catch(err: any) {
        evalErr = err.stack || err.message;
      }
      return NextResponse.json({ 
        jsonError: e.stack,
        evalError: evalErr
      });
    }
  } catch(e: any) {
    return NextResponse.json({ error: 'file not found', details: e.message });
  }
}
