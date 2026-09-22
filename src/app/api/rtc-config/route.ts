import { route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guards";

/** ICE servers for WebRTC. TURN credentials stay server-side until an authenticated user asks. */
export const GET = route(async () => {
  await requireApiUser();
  const iceServers: RTCIceServer[] = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
  if (process.env.TURN_URL) iceServers.push({ urls: process.env.TURN_URL.split(","), username: process.env.TURN_USERNAME, credential: process.env.TURN_CREDENTIAL });
  return { iceServers, turnConfigured: Boolean(process.env.TURN_URL) };
});
