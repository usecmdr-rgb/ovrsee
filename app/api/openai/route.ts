import { NextResponse } from "next/server";

export async function GET() {
  const key = process.env.OPENAI_API_KEY;

  return NextResponse.json({
    ok: !!key,
    // Do not expose any part of the key to the client
    hasKey: !!key,
  });
}





