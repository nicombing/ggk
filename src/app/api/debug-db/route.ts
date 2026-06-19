import { NextResponse } from "next/server";
import { Pool } from "pg";

export async function GET() {
  try {
    const rawUrl = process.env.DATABASE_URL || "";
    const supaUrl = process.env.SUPABASE_DATABASE_URL || "";
    
    // Mask passwords for safety
    const maskPassword = (url: string) => {
      if (!url) return "missing";
      const regex = /(postgresql:\/\/[^:]+:)([^@]+)(@.*)/;
      const match = url.match(regex);
      if (match) {
        return `${match[1]}***${match[2].slice(-4)}${match[3]}`;
      }
      return url;
    }

    const testUrl = supaUrl || rawUrl;
    let poolTest = "not attempted";

    try {
      const finalUrl = testUrl.includes("6543") && !testUrl.includes("pgbouncer=true") 
        ? `${testUrl}${testUrl.includes("?") ? "&" : "?"}pgbouncer=true` 
        : testUrl;

      const pool = new Pool({
        connectionString: finalUrl,
        ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined
      });
      
      const client = await pool.connect();
      client.release();
      poolTest = "success";
    } catch (e: any) {
      poolTest = e.message;
    }

    return NextResponse.json({
      DATABASE_URL_MASKED: maskPassword(rawUrl),
      SUPABASE_DATABASE_URL_MASKED: maskPassword(supaUrl),
      POOL_TEST: poolTest,
      NODE_ENV: process.env.NODE_ENV
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message });
  }
}
