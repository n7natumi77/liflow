export type DiscordInteraction = {
  id?: string;
  application_id?: string;
  token?: string;
  type: number;
  channel_id?: string;
  guild_id?: string;
  member?: { user?: { id?: string } };
  user?: { id?: string };
  data?: { name?: string; options?: { name: string; value?: string | number; options?: { name: string; value?: string | number }[] }[] };
};

const bytes = (hex: string) => {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2) throw new Error("discord_signature_invalid_hex");
  return Uint8Array.from(hex.match(/.{2}/g) || [], value => Number.parseInt(value, 16));
};

export async function verifyDiscordSignature(signature: string, timestamp: string, body: string, publicKey: string) {
  try {
    const key = await crypto.subtle.importKey("raw", bytes(publicKey), { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify({ name: "Ed25519" }, key, bytes(signature), new TextEncoder().encode(timestamp + body));
  } catch {
    return false;
  }
}

export const discordUserId = (interaction: DiscordInteraction) => interaction.member?.user?.id || interaction.user?.id || "";
export const mutationCommand = (name: string) => ["t", "task", "p", "plan", "a", "actual", "m", "money-add", "x", "bulk", "liflow"].includes(name);
export const trustedDiscordContext = (interaction: DiscordInteraction, channelIds: Set<string>) => Boolean(interaction.channel_id && channelIds.has(interaction.channel_id));
export const allowedDiscordMutation = (interaction: DiscordInteraction, userIds: Set<string>) => userIds.has(discordUserId(interaction));
export const optionRecord = (interaction: DiscordInteraction) => Object.fromEntries((interaction.data?.options || []).map(option => [option.name, option.value ?? option.options?.[0]?.value ?? ""]));
export const splitDiscordMessage = (text: string, limit = 1900) => {
  const result: string[] = [];
  let current = "";
  for (const line of text.split("\n")) {
    if ((current + (current ? "\n" : "") + line).length <= limit) { current += (current ? "\n" : "") + line; continue; }
    if (current) result.push(current);
    if (line.length <= limit) current = line;
    else { for (let index = 0; index < line.length; index += limit) result.push(line.slice(index, index + limit)); current = ""; }
  }
  if (current) result.push(current);
  return result.length ? result : [""];
};

