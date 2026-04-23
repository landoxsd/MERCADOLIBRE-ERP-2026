import { NextResponse } from 'next/server';
import { getSettings, saveSettings } from '@/lib/settings';

export async function GET() {
  return NextResponse.json(getSettings());
}

export async function POST(req) {
  const body = await req.json();
  const res = saveSettings(body);
  return NextResponse.json(res);
}
