import { NextResponse } from "next/server";
const FIREBASE_API_KEY = "AIzaSyD-rsAZ3ZpebNlpYoNKkpwWB7zbdsG4_Eo";
const validWebhook = (value: string) => {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "discord.com" || url.hostname === "discordapp.com") &&
      url.pathname.startsWith("/api/webhooks/")
    );
  } catch {
    return false;
  }
};
export async function POST(request: Request) {
  const token = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  if (!token)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const auth = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken: token }),
    },
  );
  if (!auth.ok)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await request.json()) as {
    webhookUrl?: string;
    content?: string;
  };
  if (
    !body.webhookUrl ||
    !validWebhook(body.webhookUrl) ||
    !body.content?.trim() ||
    body.content.length > 1800
  )
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const sent = await fetch(body.webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      content: body.content,
      allowed_mentions: { parse: [] },
    }),
  });
  if (!sent.ok)
    return NextResponse.json({ error: "discord_rejected" }, { status: 502 });
  return NextResponse.json({ ok: true });
}
