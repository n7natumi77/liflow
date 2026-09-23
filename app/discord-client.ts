"use client";
import { getIdToken } from "firebase/auth";
import { firebaseAuth } from "./firebase-client";
export async function sendToDiscord(webhookUrl: string, content: string) {
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error("unauthorized");
  const token = await getIdToken(user);
  const response = await fetch("/api/discord", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ webhookUrl, content }),
  });
  if (!response.ok) throw new Error("discord_send_failed");
}
