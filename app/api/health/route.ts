import { NextResponse } from "next/server";
import { CURRENT_SCHEMA_VERSION } from "../../../domain/schema";

export const runtime = "edge";
const present = (name: string) => Boolean(process.env[name]?.trim());

export function GET() {
  return NextResponse.json({
    ok: true,
    appVersion: "2.5.0",
    schemaVersion: CURRENT_SCHEMA_VERSION,
    buildId: process.env.LIFLOW_BUILD_ID || process.env.CF_PAGES_COMMIT_SHA?.slice(0, 12) || "development",
    runtime: "cloudflare-worker",
    configuration: {
      firebaseAdmin: present("FIREBASE_SERVICE_ACCOUNT_JSON"),
      discordPublicKey: present("DISCORD_PUBLIC_KEY"),
      discordTrustedChannels: present("DISCORD_TRUSTED_CHANNEL_IDS"),
      discordAllowedUsers: present("DISCORD_ALLOWED_USER_IDS"),
      liflowFirebaseUid: present("LIFLOW_FIREBASE_UID"),
      vapidPublicKey: present("NEXT_PUBLIC_FIREBASE_VAPID_KEY"),
    },
  }, { headers: { "cache-control": "no-store" } });
}
