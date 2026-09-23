"use client";
import { useEffect, useId, useRef, useState } from "react";
import type { Persona, PersonaScene } from "@/lib/ai/personas";
import { cn } from "@/lib/cn";

/**
 * An illustrated AI interviewer sitting in an office, rendered as a live
 * "video feed". Pure SVG + CSS: blinks, breathes, glances, lip-syncs while
 * speaking and nods while the candidate talks.
 */
export function InterviewerScene({
  persona,
  speaking,
  pulse = 0,
  listening = false,
  thinking = false,
  className,
}: {
  persona: Persona;
  /** Interviewer is talking — drives the lip-sync. */
  speaking: boolean;
  /** Increments on every spoken word boundary (TTS) for tighter lip-sync. */
  pulse?: number;
  /** Candidate is talking — interviewer nods occasionally. */
  listening?: boolean;
  /** Interviewer is "considering" an answer — gaze drifts away. */
  thinking?: boolean;
  className?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const id = (k: string) => `${k}-${uid}`;
  const L = persona.look;

  // --- Mouth (lip-sync) -------------------------------------------------------
  const [mouth, setMouth] = useState(0);
  const target = useRef(0);
  useEffect(() => {
    if (!speaking) {
      target.current = 0;
      setMouth(0);
      return;
    }
    let raf = 0;
    let last = 0;
    let t = 0;
    const tick = (now: number) => {
      if (now - last > 70) {
        last = now;
        t += 1;
        // Syllable-like rhythm with some variety; word boundaries add emphasis.
        const syllable = 0.35 + 0.45 * Math.abs(Math.sin(t * 1.7)) * (0.6 + Math.random() * 0.4);
        target.current = Math.random() < 0.12 ? 0.08 : syllable;
      }
      setMouth((m) => m + (target.current - m) * 0.45);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speaking]);
  useEffect(() => {
    if (speaking && pulse) target.current = 0.95;
  }, [pulse, speaking]);

  // --- Blinking -----------------------------------------------------------------
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        setBlink(true);
        setTimeout(() => setBlink(false), 130);
        schedule();
      }, 2200 + Math.random() * 3800);
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);

  // --- Gaze ---------------------------------------------------------------------
  const [gaze, setGaze] = useState({ x: 0, y: 0 });
  useEffect(() => {
    if (thinking) {
      setGaze({ x: -4, y: -4 });
      return;
    }
    setGaze({ x: 0, y: 0 });
    const t = setInterval(() => {
      const options = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1.5, y: 0.5 }, { x: -1.5, y: 0.5 }, { x: 0, y: 1 }];
      setGaze(options[Math.floor(Math.random() * options.length)]);
    }, 2600);
    return () => clearInterval(t);
  }, [thinking]);

  // --- Nodding while the candidate talks -------------------------------------------
  const [nod, setNod] = useState(false);
  useEffect(() => {
    if (!listening) return;
    const t = setInterval(() => {
      setNod(true);
      setTimeout(() => setNod(false), 1150);
    }, 3800 + Math.random() * 2000);
    return () => clearInterval(t);
  }, [listening]);

  const o = Math.max(0, Math.min(1, mouth));
  const eye = (cx: number) => (
    <g style={{ transformBox: "fill-box", transformOrigin: "center", transform: `scaleY(${blink ? 0.08 : 1})`, transition: "transform 60ms" }}>
      <clipPath id={id(`eye${cx}`)}>
        <ellipse cx={cx} cy={325} rx={14} ry={8.5} />
      </clipPath>
      <ellipse cx={cx} cy={325} rx={14} ry={8.5} fill="#FBF8F4" />
      <g clipPath={`url(#${id(`eye${cx}`)})`} style={{ transform: `translate(${gaze.x}px, ${gaze.y}px)`, transition: "transform 280ms ease-out" }}>
        <circle cx={cx} cy={325} r={7.2} fill={L.iris} />
        <circle cx={cx} cy={325} r={3.4} fill="#0E0B0A" />
        <circle cx={cx + 2.2} cy={322.6} r={1.8} fill="#fff" opacity={0.9} />
      </g>
      <path d={`M ${cx - 15} 323 Q ${cx} 313 ${cx + 15} 323`} stroke="#2A1E18" strokeWidth={2.4} fill="none" strokeLinecap="round" />
    </g>
  );

  return (
    <svg viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid slice" className={cn("h-full w-full", className)} role="img" aria-label={`${persona.name}, AI interviewer, ${speaking ? "speaking" : listening ? "listening" : "on camera"}`}>
      <defs>
        <filter id={id("blur")} x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur stdDeviation="2.6" />
        </filter>
        <radialGradient id={id("vignette")} cx="50%" cy="45%" r="75%">
          <stop offset="60%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.42" />
        </radialGradient>
        <radialGradient id={id("key")} cx="30%" cy="20%" r="70%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g filter={`url(#${id("blur")})`}>
        <Scene scene={persona.scene} id={id} />
      </g>

      {/* Person — framed head-and-shoulders like a webcam shot */}
      <g transform="translate(640 720) scale(1.32) translate(-640 -720)">
      <g className="ic-breathe">
        {/* Long / bob hair behind the head */}
        {L.hairStyle === "long" && <path d="M 540 300 C 522 420 532 520 548 575 L 732 575 C 748 520 758 420 740 300 Z" fill={L.hair} />}
        {L.hairStyle === "bob" && <path d="M 543 295 C 532 380 538 432 556 452 L 724 452 C 742 432 748 380 737 295 Z" fill={L.hair} />}

        {/* Torso */}
        <path d="M 350 720 C 360 612 425 562 520 542 L 592 520 L 640 600 L 688 520 L 760 542 C 855 562 920 612 930 720 Z" fill={L.blazer} />
        <path d="M 350 720 C 360 640 395 596 450 572 C 430 620 425 680 428 720 Z" fill={L.blazerShadow} opacity={0.7} />
        <path d="M 930 720 C 920 640 885 596 830 572 C 850 620 855 680 852 720 Z" fill={L.blazerShadow} opacity={0.7} />
        <path d="M 600 500 L 680 500 L 640 590 Z" fill={L.tie ? L.shirt : L.skin} />
        <path d={L.tie ? "M 594 520 L 640 598 L 686 520 L 668 506 L 640 552 L 612 506 Z" : "M 592 520 L 640 612 L 688 520 L 668 504 L 640 560 L 612 504 Z"} fill={L.shirt} />
        {L.tie && (
          <g>
            <path d="M 630 552 L 650 552 L 655 566 L 648 650 L 640 664 L 632 650 L 625 566 Z" fill={L.tie} />
            <path d="M 630 552 L 650 552 L 646 566 L 634 566 Z" fill="#000" opacity={0.18} />
          </g>
        )}
        <path d="M 592 520 L 556 544 L 606 660 L 640 604 Z" fill={L.blazerShadow} />
        <path d="M 688 520 L 724 544 L 674 660 L 640 604 Z" fill={L.blazerShadow} />

        {/* Neck */}
        <path d="M 606 432 L 606 516 Q 640 548 674 516 L 674 432 Z" fill={L.skin} />
        <ellipse cx={640} cy={452} rx={34} ry={11} fill={L.skinShadow} opacity={0.32} />

        {/* Head */}
        <g className="ic-sway">
          <g className={cn(nod && "ic-nod")}>
            <ellipse cx={549} cy={342} rx={15} ry={25} fill={L.skin} />
            <ellipse cx={731} cy={342} rx={15} ry={25} fill={L.skin} />
            <ellipse cx={551} cy={344} rx={7} ry={13} fill={L.skinShadow} opacity={0.5} />
            <ellipse cx={729} cy={344} rx={7} ry={13} fill={L.skinShadow} opacity={0.5} />

            <path d="M 640 206 C 710 206 736 262 736 330 C 736 402 700 456 640 460 C 580 456 544 402 544 330 C 544 262 570 206 640 206 Z" fill={L.skin} />
            <path d="M 700 230 C 728 262 736 300 736 332 C 736 400 702 452 648 459 C 690 430 712 380 713 330 C 714 290 710 258 700 230 Z" fill={L.skinShadow} opacity={0.35} />
            {persona.gender === "male" && <path d="M 572 400 C 590 445 620 458 640 459 C 662 458 692 445 708 400 C 700 430 672 450 640 452 C 608 450 580 430 572 400 Z" fill={L.hair} opacity={0.22} />}
            <ellipse cx={596} cy={372} rx={20} ry={11} fill={L.lip} opacity={0.12} />
            <ellipse cx={684} cy={372} rx={20} ry={11} fill={L.lip} opacity={0.12} />

            {/* Hair (front) */}
            {L.hairStyle === "short" && (
              <g fill={L.hair}>
                <path d="M 547 304 C 541 240 584 196 640 194 C 698 196 740 240 733 304 C 729 288 723 274 713 264 C 692 254 668 251 652 254 C 646 256 642 259 640 262 C 638 259 634 256 628 254 C 612 251 588 254 567 264 C 557 274 551 288 547 304 Z" />
                <path d="M 547 300 C 548 312 550 322 553 330 L 557 330 C 555 318 554 308 555 298 Z" opacity={0.85} />
                <path d="M 733 300 C 732 312 730 322 727 330 L 723 330 C 725 318 726 308 725 298 Z" opacity={0.85} />
              </g>
            )}
            {L.hairStyle === "bob" && (
              <g fill={L.hair}>
                <path d="M 538 334 C 526 236 586 192 646 195 C 712 198 756 250 742 338 C 736 300 718 268 688 252 C 660 262 612 252 588 238 C 562 262 548 294 538 334 Z" />
                <path d="M 542 296 C 532 358 536 412 558 446 L 574 446 C 562 404 560 352 568 300 Z" />
                <path d="M 738 296 C 748 358 744 412 722 446 L 706 446 C 718 404 720 352 712 300 Z" />
              </g>
            )}
            {L.hairStyle === "long" && (
              <g fill={L.hair}>
                <path d="M 540 334 C 528 232 590 192 642 194 C 702 194 752 238 740 334 C 728 292 704 262 660 250 C 622 262 584 262 560 282 C 550 296 544 312 540 334 Z" />
                <path d="M 546 298 C 528 380 532 470 548 548 L 576 548 C 564 470 560 380 572 300 Z" />
                <path d="M 734 298 C 752 380 748 470 732 548 L 704 548 C 716 470 720 380 708 300 Z" />
              </g>
            )}

            {/* Brows */}
            <g style={{ transform: `translateY(${speaking ? -1.5 : 0}px)`, transition: "transform 200ms" }} stroke={L.brow} strokeWidth={6} strokeLinecap="round" fill="none">
              <path d="M 588 294 Q 606 283 626 291" />
              <path d="M 654 291 Q 674 283 692 294" />
            </g>

            {/* Eyes */}
            {eye(607)}
            {eye(673)}

            {L.glasses && (
              <g fill="rgba(255,255,255,0.06)" stroke="#1C1C1C" strokeWidth={3.5}>
                <rect x={583} y={308} width={48} height={34} rx={11} />
                <rect x={649} y={308} width={48} height={34} rx={11} />
                <path d="M 631 322 Q 640 316 649 322" fill="none" />
                <path d="M 583 318 L 552 314" fill="none" />
                <path d="M 697 318 L 728 314" fill="none" />
              </g>
            )}

            {/* Nose */}
            <path d="M 638 332 C 634 352 627 368 631 377 C 637 383 647 383 653 377" stroke={L.skinShadow} strokeWidth={3} fill="none" strokeLinecap="round" />
            <ellipse cx={634} cy={378} rx={4} ry={2.4} fill={L.skinShadow} opacity={0.6} />
            <ellipse cx={649} cy={378} rx={4} ry={2.4} fill={L.skinShadow} opacity={0.6} />

            {/* Mouth — lip-synced */}
            <g>
              {o > 0.04 && <ellipse cx={640} cy={409 + o * 4} rx={19 + o * 3} ry={1.5 + o * 9.5} fill="#3B1614" />}
              {o > 0.35 && <rect x={627} y={405} width={26} height={3 + o * 2} rx={1.5} fill="#F6F1EA" opacity={0.95} />}
              <path d={`M 616 406 Q 628 ${401 - o * 2} 640 ${404 - o * 1.5} Q 652 ${401 - o * 2} 664 406`} stroke={L.lip} strokeWidth={3.6} fill="none" strokeLinecap="round" />
              <path d={`M 619 ${409 + o * 1} Q 640 ${415 + o * 18} 661 ${409 + o * 1}`} stroke={L.lip} strokeWidth={4.8} fill="none" strokeLinecap="round" />
              {o < 0.05 && <path d="M 614 405 Q 640 416 666 405" stroke={L.lip} strokeWidth={3.2} fill="none" strokeLinecap="round" opacity={0.9} />}
            </g>
          </g>
        </g>
      </g>

      </g>

      {/* Desk edge in front */}
      <Desk scene={persona.scene} />

      {/* Lighting + lens vignette */}
      <rect width={1280} height={720} fill={`url(#${id("key")})`} />
      <rect width={1280} height={720} fill={`url(#${id("vignette")})`} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Backgrounds
// ---------------------------------------------------------------------------

function Scene({ scene, id }: { scene: PersonaScene; id: (k: string) => string }) {
  if (scene === "finance") return <FinanceOffice id={id} />;
  if (scene === "consulting") return <ConferenceRoom id={id} />;
  return <TechOffice id={id} />;
}

const BOOK_COLORS = {
  tech: ["#E4572E", "#29335C", "#F3A712", "#669BBC", "#A8C686", "#2E4057", "#D8C3A5"],
  finance: ["#6E1F2B", "#2F4A3A", "#8A6A3A", "#1F2E4A", "#4A2F2A", "#5C4A2E"],
};

function Books({ x, y, width, palette, seed }: { x: number; y: number; width: number; palette: string[]; seed: number }) {
  const books: React.ReactNode[] = [];
  let cx = x;
  let i = seed;
  while (cx < x + width - 14) {
    const w = 12 + ((i * 7) % 14);
    const h = 70 + ((i * 13) % 34);
    books.push(<rect key={cx} x={cx} y={y - h} width={w} height={h} rx={1.5} fill={palette[i % palette.length]} />);
    cx += w + 2;
    i += 1;
    if (i % 6 === 0) cx += 18;
  }
  return <>{books}</>;
}

function TechOffice({ id }: { id: (k: string) => string }) {
  return (
    <g>
      <defs>
        <linearGradient id={id("wall")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#EEF1EC" />
          <stop offset="1" stopColor="#D9DFD5" />
        </linearGradient>
        <linearGradient id={id("sky")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#CFE4F2" />
          <stop offset="1" stopColor="#EEF5F8" />
        </linearGradient>
      </defs>
      <rect width={1280} height={720} fill={`url(#${id("wall")})`} />
      {/* Window */}
      <rect x={820} y={70} width={390} height={410} fill={`url(#${id("sky")})`} />
      {[[840, 300, 60, 180], [905, 250, 55, 230], [965, 320, 70, 160], [1040, 220, 60, 260], [1105, 290, 90, 190]].map(([x, y, w, h]) => (
        <rect key={x} x={x} y={y} width={w} height={h} fill="#B7C7D2" />
      ))}
      <rect x={820} y={70} width={390} height={410} fill="none" stroke="#FFFFFF" strokeWidth={14} />
      <line x1={1015} y1={70} x2={1015} y2={480} stroke="#FFFFFF" strokeWidth={8} />
      {/* Shelves */}
      <rect x={70} y={140} width={290} height={400} fill="#FAFAF8" />
      {[260, 380, 500].map((y) => <rect key={y} x={70} y={y} width={290} height={8} fill="#E3E3DE" />)}
      <Books x={84} y={260} width={200} palette={BOOK_COLORS.tech} seed={1} />
      <Books x={120} y={380} width={220} palette={BOOK_COLORS.tech} seed={4} />
      <rect x={300} y={228} width={34} height={32} rx={4} fill="#E6E1D8" />
      <ellipse cx={317} cy={220} rx={26} ry={16} fill="#4E7A45" />
      <rect x={90} y={452} width={70} height={48} rx={3} fill="#2E4057" />
      <rect x={96} y={458} width={58} height={36} fill="#9FB8C9" />
      {/* Floor plant */}
      <g>
        <ellipse cx={1150} cy={470} rx={40} ry={90} fill="#3F6B3A" transform="rotate(-18 1150 470)" />
        <ellipse cx={1190} cy={500} rx={34} ry={80} fill="#4E7A45" transform="rotate(20 1190 500)" />
        <ellipse cx={1120} cy={520} rx={30} ry={70} fill="#5E8A52" transform="rotate(-40 1120 520)" />
        <rect x={1110} y={560} width={100} height={110} rx={8} fill="#E6E1D8" />
      </g>
      {/* Pendant light glow */}
      <ellipse cx={640} cy={40} rx={260} ry={70} fill="#FFFFFF" opacity={0.35} />
    </g>
  );
}

function FinanceOffice({ id }: { id: (k: string) => string }) {
  const lit: React.ReactNode[] = [];
  const towers = [[800, 250, 70, 250], [875, 190, 60, 310], [940, 280, 80, 220], [1025, 150, 70, 350], [1100, 230, 60, 270], [1165, 300, 70, 200]];
  towers.forEach(([x, y, w, h], ti) => {
    const rows = Math.floor((h - 20) / 18);
    const cols = Math.floor((w - 10) / 14);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) if ((r * 7 + c * 3 + ti * 5) % 5 < 2) lit.push(<rect key={`${ti}-${r}-${c}`} x={x + 8 + c * 14} y={y + 12 + r * 18} width={6} height={8} fill="#F7D774" opacity={0.85} />);
  });
  return (
    <g>
      <defs>
        <linearGradient id={id("panel")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4B3B30" />
          <stop offset="1" stopColor="#2E241D" />
        </linearGradient>
        <linearGradient id={id("dusk")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2E3A5C" />
          <stop offset="0.55" stopColor="#8A5C7A" />
          <stop offset="1" stopColor="#F2A65A" />
        </linearGradient>
        <radialGradient id={id("lamp")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFD89A" stopOpacity="0.7" />
          <stop offset="1" stopColor="#FFD89A" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={1280} height={720} fill={`url(#${id("panel")})`} />
      {[0, 180, 360].map((x) => <rect key={x} x={x + 20} y={40} width={150} height={600} fill="none" stroke="#5C4A3C" strokeWidth={3} opacity={0.6} />)}
      {/* Window with skyline at dusk */}
      <rect x={780} y={60} width={450} height={440} fill={`url(#${id("dusk")})`} />
      {towers.map(([x, y, w, h]) => <rect key={x} x={x} y={y} width={w} height={h} fill="#1D2231" />)}
      {lit}
      <rect x={780} y={60} width={450} height={440} fill="none" stroke="#2A2019" strokeWidth={16} />
      <line x1={1005} y1={60} x2={1005} y2={500} stroke="#2A2019" strokeWidth={10} />
      {/* Bookcase */}
      <rect x={60} y={120} width={300} height={430} fill="#2A1F18" />
      {[250, 380, 510].map((y) => <rect key={y} x={60} y={y} width={300} height={10} fill="#3A2B21" />)}
      <Books x={74} y={250} width={270} palette={BOOK_COLORS.finance} seed={2} />
      <Books x={74} y={380} width={270} palette={BOOK_COLORS.finance} seed={5} />
      {/* Brass desk lamp glow */}
      <ellipse cx={250} cy={560} rx={160} ry={120} fill={`url(#${id("lamp")})`} />
      <path d="M 210 640 L 290 640 L 280 628 L 220 628 Z" fill="#B08D57" />
      <rect x={246} y={560} width={8} height={70} fill="#B08D57" />
      <path d="M 200 560 L 300 560 L 280 520 L 220 520 Z" fill="#1F4A38" />
    </g>
  );
}

function ConferenceRoom({ id }: { id: (k: string) => string }) {
  return (
    <g>
      <defs>
        <linearGradient id={id("warm")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F6F2EB" />
          <stop offset="1" stopColor="#E6DFD3" />
        </linearGradient>
        <linearGradient id={id("day")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#BFDDF0" />
          <stop offset="1" stopColor="#E9F3F8" />
        </linearGradient>
      </defs>
      <rect width={1280} height={720} fill={`url(#${id("warm")})`} />
      {/* Whiteboard with a 2x2 framework */}
      <rect x={70} y={100} width={430} height={310} rx={6} fill="#FFFFFF" stroke="#B9B9B5" strokeWidth={8} />
      <g stroke="#2F5AA8" strokeWidth={4} fill="none" strokeLinecap="round">
        <line x1={120} y1={250} x2={330} y2={250} />
        <line x1={225} y1={150} x2={225} y2={360} />
        <path d="M 330 250 L 318 242 M 330 250 L 318 258" />
      </g>
      <g stroke="#C23B3B" strokeWidth={4} fill="none" strokeLinecap="round">
        <circle cx={280} cy={195} r={22} />
        <path d="M 360 170 L 460 170 M 360 200 L 440 200 M 360 230 L 452 230" stroke="#333" strokeWidth={3} />
        <rect x={360} y={280} width={100} height={60} rx={6} />
        <path d="M 302 205 C 330 230 340 270 356 300" />
      </g>
      <g stroke="#333" strokeWidth={3} strokeLinecap="round">
        <path d="M 130 170 L 190 170 M 240 330 L 300 330 M 130 330 L 180 330" />
      </g>
      {/* Window */}
      <rect x={900} y={80} width={310} height={390} fill={`url(#${id("day")})`} />
      <ellipse cx={980} cy={450} rx={110} ry={70} fill="#8DB580" />
      <ellipse cx={1120} cy={440} rx={120} ry={80} fill="#7AA36E" />
      <rect x={900} y={80} width={310} height={390} fill="none" stroke="#FFFFFF" strokeWidth={12} />
      <line x1={1055} y1={80} x2={1055} y2={470} stroke="#FFFFFF" strokeWidth={7} />
      {/* Plant */}
      <ellipse cx={1180} cy={520} rx={30} ry={70} fill="#4E7A45" transform="rotate(15 1180 520)" />
      <ellipse cx={1150} cy={530} rx={26} ry={60} fill="#5E8A52" transform="rotate(-25 1150 530)" />
      <rect x={1130} y={570} width={80} height={90} rx={6} fill="#D8CFC0" />
    </g>
  );
}

function Desk({ scene }: { scene: PersonaScene }) {
  const top = scene === "finance" ? "#3A2A20" : scene === "consulting" ? "#E7DCCB" : "#C9A57E";
  const edge = scene === "finance" ? "#2A1E17" : scene === "consulting" ? "#D2C4AE" : "#AE8A63";
  return (
    <g>
      <rect x={0} y={668} width={1280} height={52} fill={top} />
      <rect x={0} y={668} width={1280} height={6} fill={edge} />
      {scene === "consulting" && (
        <g>
          <rect x={890} y={600} width={34} height={70} rx={4} fill="#DCEFF7" opacity={0.75} stroke="#B9D4E0" strokeWidth={2} />
          <rect x={893} y={630} width={28} height={37} fill="#BFE0EE" opacity={0.8} />
        </g>
      )}
      {scene === "tech" && (
        <g>
          <rect x={860} y={622} width={50} height={48} rx={6} fill="#2E4057" />
          <path d="M 910 634 C 928 634 928 656 910 656" stroke="#2E4057" strokeWidth={6} fill="none" />
        </g>
      )}
      {scene === "finance" && <rect x={350} y={650} width={140} height={20} rx={2} fill="#1A1410" />}
    </g>
  );
}
