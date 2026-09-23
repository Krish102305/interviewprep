"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type Signal = { kind: "description" | "candidate" | "hello" | "bye"; payload: unknown };
export type PeerState = "idle" | "connecting" | "connected" | "reconnecting" | "failed";

const post = (url: string, body: unknown) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);

/**
 * Peer-to-peer video between the two participants using the "perfect
 * negotiation" pattern. Signaling (SDP + ICE) is relayed through our API; media
 * never touches the server. TURN servers can be added via env (see /api/rtc-config).
 */
export function useWebRTC({ interviewId, localStream, polite, enabled }: { interviewId: string; localStream: MediaStream | null; polite: boolean; enabled: boolean }) {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [peerState, setPeerState] = useState<PeerState>("idle");
  const [sharing, setSharing] = useState(false);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const iceServers = useRef<RTCIceServer[] | null>(null);
  const makingOffer = useRef(false);
  const ignoreOffer = useRef(false);
  const screenTrack = useRef<MediaStreamTrack | null>(null);
  const url = `/api/interviews/${interviewId}/signal`;
  const logTech = useCallback((type: string, details?: string) => post(`/api/interviews/${interviewId}/technical`, { type, details }), [interviewId]);

  const send = useCallback((s: Signal) => post(url, s), [url]);

  const createPc = useCallback(() => {
    pcRef.current?.close();
    const pc = new RTCPeerConnection({ iceServers: iceServers.current ?? [] });
    pcRef.current = pc;
    setPeerState("connecting");
    const remote = new MediaStream();
    setRemoteStream(remote);
    localStream?.getTracks().forEach((t) => pc.addTrack(t, localStream));
    pc.ontrack = ({ track }) => {
      remote.addTrack(track);
      setRemoteStream(new MediaStream(remote.getTracks()));
    };
    pc.onicecandidate = ({ candidate }) => candidate && send({ kind: "candidate", payload: candidate.toJSON() });
    pc.onnegotiationneeded = async () => {
      try {
        makingOffer.current = true;
        await pc.setLocalDescription();
        await send({ kind: "description", payload: pc.localDescription?.toJSON() });
      } catch (e) {
        console.warn("[rtc] negotiation failed", e);
      } finally {
        makingOffer.current = false;
      }
    };
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === "connected") setPeerState("connected");
      else if (s === "disconnected") {
        setPeerState("reconnecting");
        logTech("connection_lost", "Peer connection disconnected");
        post(`/api/interviews/${interviewId}/connection`, { state: "reconnecting" });
      } else if (s === "failed") {
        setPeerState("reconnecting");
        logTech("ice_failed", "Peer connection failed, restarting ICE");
        pc.restartIce();
      }
      if (s === "connected") post(`/api/interviews/${interviewId}/connection`, { state: "connected" });
    };
    return pc;
  }, [localStream, send, logTech, interviewId]);

  const handle = useCallback(
    async (s: Signal) => {
      if (s.kind === "hello") {
        // The other side (re)joined: start over with a fresh connection.
        createPc();
        return;
      }
      const pc = pcRef.current ?? createPc();
      try {
        if (s.kind === "description") {
          const desc = s.payload as RTCSessionDescriptionInit;
          const collision = desc.type === "offer" && (makingOffer.current || pc.signalingState !== "stable");
          ignoreOffer.current = !polite && collision;
          if (ignoreOffer.current) return;
          await pc.setRemoteDescription(desc);
          if (desc.type === "offer") {
            await pc.setLocalDescription();
            await send({ kind: "description", payload: pc.localDescription?.toJSON() });
          }
        } else if (s.kind === "candidate") {
          try {
            await pc.addIceCandidate(s.payload as RTCIceCandidateInit);
          } catch (e) {
            if (!ignoreOffer.current) throw e;
          }
        } else if (s.kind === "bye") {
          setPeerState("reconnecting");
        }
      } catch (e) {
        console.warn("[rtc] signal handling failed", e);
      }
    },
    [createPc, polite, send],
  );

  useEffect(() => {
    if (!enabled || !localStream) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    (async () => {
      const cfg = await fetch("/api/rtc-config").then((r) => r.json()).catch(() => null);
      iceServers.current = cfg?.iceServers ?? [{ urls: "stun:stun.l.google.com:19302" }];
      // Drain stale signals from a previous session, then announce ourselves.
      await fetch(url, { cache: "no-store" }).catch(() => null);
      if (stopped) return;
      createPc();
      await send({ kind: "hello", payload: null });
      const poll = async () => {
        if (stopped) return;
        const res = await fetch(url, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
        for (const s of (res?.signals ?? []) as Signal[]) await handle(s);
        timer = setTimeout(poll, 1000);
      };
      poll();
    })();
    return () => {
      stopped = true;
      clearTimeout(timer);
      send({ kind: "bye", payload: null });
      pcRef.current?.close();
      pcRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, localStream]);

  const toggleScreenShare = useCallback(async () => {
    const pc = pcRef.current;
    const sender = pc?.getSenders().find((s) => s.track?.kind === "video");
    const camTrack = localStream?.getVideoTracks()[0] ?? null;
    if (sharing) {
      screenTrack.current?.stop();
      screenTrack.current = null;
      if (sender) await sender.replaceTrack(camTrack);
      setSharing(false);
      return;
    }
    if (!navigator.mediaDevices?.getDisplayMedia) throw new Error("Screen sharing isn't supported in this browser.");
    const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
    const track = display.getVideoTracks()[0];
    screenTrack.current = track;
    if (sender) await sender.replaceTrack(track);
    setSharing(true);
    track.onended = async () => {
      if (sender) await sender.replaceTrack(camTrack);
      setSharing(false);
    };
  }, [localStream, sharing]);

  return { remoteStream, peerState, sharing, toggleScreenShare, screenSupported: typeof navigator !== "undefined" && Boolean(navigator.mediaDevices && "getDisplayMedia" in navigator.mediaDevices) };
}
