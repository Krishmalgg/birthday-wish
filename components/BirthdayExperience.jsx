"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { BLOW, CAKE, COPY, COVER, PERSON, whatsappLink } from "@/lib/config";
import { calculateAge, isBirthdayToday, nextBirthdayAt, ordinal, readParams } from "@/lib/age";
import { createAudioManager } from "@/lib/audio";
import { warmConfetti } from "@/lib/confetti";
import { buildSong, createSongPlayer } from "@/lib/song";
import { useBlowDetection } from "@/hooks/useBlowDetection";

import Backdrop from "./Backdrop";
import WelcomeScreen from "./WelcomeScreen";
import Cake from "./Cake";
import BirthdayBurst from "./BirthdayBurst";
import SongLyrics from "./SongLyrics";
import BlowCheer, { useBlowCheer } from "./BlowCheer";

/** Mic-state prompt text */
function promptFor(status, out, micReady, armed) {
  if (out) return null;
  if (status === "listening" && !micReady) return "Getting the microphone ready…";
  if (!armed && (status === "listening" || status === "requesting" || status === "idle"))
    return "Sing along first, then blow out the candles.";
  switch (status) {
    case "requesting":  return "Allow the microphone to blow the candles out.";
    case "insecure":    return "Open on https or localhost to use the microphone.";
    case "denied":      return "No microphone? Tap the button below instead.";
    case "unsupported": return "This browser can't use the microphone. Tap below instead.";
    default:            return "Make a wish, then blow towards your phone.";
  }
}

/** WhatsApp icon */
const WAIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor">
    <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15s-.77.97-.94 1.17-.35.22-.65.07a8.13 8.13 0 0 1-2.4-1.48 9 9 0 0 1-1.66-2.06c-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.07 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.18-1.42-.08-.12-.28-.2-.58-.35Z" />
    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.05-1.32A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.18-1.14l-.3-.18-3 .79.8-2.92-.2-.3A8.2 8.2 0 1 1 12 20.2Z" />
  </svg>
);

export default function BirthdayExperience() {
  const searchParams = useSearchParams();

  const [now, setNow] = useState(null);
  useEffect(() => setNow(new Date()), []);

  // fetch the 3D cake (three.js) while the cover is showing, so it's ready the
  // moment the surprise opens instead of a placeholder showing first
  useEffect(() => {
    import("@/lib/cake3d").catch(() => {});
  }, []);

  const { name, dob } = useMemo(() => (now ? readParams(searchParams, now) : {}), [searchParams, now]);
  const age    = useMemo(() => (now && dob ? calculateAge(dob, now) : null), [now, dob]);
  const target = useMemo(() => (now && dob ? nextBirthdayAt(dob, now) : null), [now, dob]);

  const [phase, setPhase]           = useState(null);
  const [locked, setLocked]         = useState(true);
  const [started, setStarted]       = useState(false);
  const [out, setOut]               = useState(false);
  const [revealed, setRevealed]     = useState(false);
  const [burst, setBurst]           = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const [micReady, setMicReady]         = useState(false);
  const [muted, setMuted]               = useState(false);
  const [songRun, setSongRun]           = useState(0);
  const [songDone, setSongDone]         = useState(false);
  const [player, setPlayer]             = useState(null);
  const [armed, setArmed]               = useState(false); // blowing counts only after the song
  const [callout, setCallout]           = useState(false); // big "Blow out the candles!" after it

  const audioRef       = useRef(null);
  const cakeRef        = useRef(null);
  const meterRef       = useRef(null);
  const liveRef        = useRef(null);
  const calibratedRef  = useRef(false);
  const celebratedRef  = useRef(false);
  const blowRef        = useRef(null);
  const playerRef      = useRef(null);
  const armedRef       = useRef(false);
  const timers         = useRef([]);

  const { cheer, feed: feedCheer, clear: clearCheer } = useBlowCheer();

  const later = useCallback((fn, ms) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);

  /* Always open on the cover; it's unlocked on the day itself (or with ?skip=1) */
  useEffect(() => {
    if (!now || !dob || phase) return;
    const preview = searchParams.get("preview");
    const skip    = searchParams.get("skip") === "1";
    setLocked(preview === "countdown" || !(skip || isBirthdayToday(dob, now)));
    setPhase("cover");
  }, [now, dob, phase, searchParams]);

  const unlock = useCallback(() => setLocked(false), []);

  /* The song has finished: a big "Blow out the candles!" for about a second,
     then blowing opens */
  const callingRef = useRef(false);
  const arm = useCallback(() => {
    if (armedRef.current || callingRef.current || celebratedRef.current) return;
    callingRef.current = true;
    setCallout(true);
    later(() => {
      callingRef.current = false;
      setCallout(false);
      if (celebratedRef.current) return;
      armedRef.current = true;
      setArmed(true);
    }, 1200);
  }, [later]);

  /* Blow feedback – direct DOM writes, every frame. --blow is breath strength
     (1 = strong enough to count): softer than that only makes the flames flicker.
     While the song plays the flames stay calm and nothing counts. */
  const handleLevel = useCallback((level) => {
    const { calibrating, blowing, strength = 0, progress } = level;
    const breath = armedRef.current ? Math.min(1, strength) : 0;
    const cake = cakeRef.current;
    if (cake) {
      cake.dataset.blowing = String(blowing);
      cake.style.setProperty("--blow", breath.toFixed(2));
      cake.style.setProperty("--p", progress.toFixed(2));
    }
    if (meterRef.current) meterRef.current.style.width = `${Math.round(progress * 100)}%`;
    if (liveRef.current)  liveRef.current.style.width  = `${Math.round(breath * 100)}%`;

    if (calibrating) return;
    if (!calibratedRef.current) {
      calibratedRef.current = true;
      setMicReady(true);
    }
    if (armedRef.current) feedCheer(level);
  }, [feedCheer]);

  /* Candles out */
  const celebrate = useCallback(() => {
    if (celebratedRef.current) return;
    celebratedRef.current = true;

    blowRef.current?.stop();
    if (cakeRef.current) cakeRef.current.dataset.blowing = "false";
    playerRef.current?.stop(700);
    setSongDone(true);

    clearCheer();
    setOut(true);
    audioRef.current?.celebrate();
    try { navigator.vibrate?.([180, 90, 180, 90, 360]); } catch {}

    // Smoke rises for a moment, then the "Happy 21st" moment plays — with the
    // one confetti burst — and hands back to this page
    later(() => setBurst(true), 1300);
  }, [later, clearCheer]);

  const burstDone = useCallback(() => {
    setBurst(false);
    setRevealed(true);
  }, []);

  const blow = useBlowDetection({ onBlow: celebrate, onLevel: handleLevel, armed });
  useEffect(() => { blowRef.current = blow; });

  /* Opening the surprise */
  const handleStart = async () => {
    if (started) return;
    setStarted(true);

    // Both created inside the tap, so the browser allows sound afterwards
    const audio = createAudioManager();
    audioRef.current = audio;
    audio.unlock();
    const songPlayer = createSongPlayer();
    playerRef.current = songPlayer;
    setPlayer(songPlayer);
    warmConfetti();

    later(() => setPhase("celebration"), 650);
    // the song starts once the cake is on screen; blowing opens when it ends
    later(() => {
      if (celebratedRef.current) return;
      playSong();
    }, 1700);
    armSafety(1700);

    await blow.start();
  };

  /* In case the song can't play (sound blocked, no song): open blowing anyway */
  function armSafety(delay) {
    later(arm, delay + (song ? song.duration * 1000 + 3000 : 0));
  }

  /* "Try again": light the candles, sing again, blow again */
  const tryAgain = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    celebratedRef.current = false;
    armedRef.current = false;
    callingRef.current = false;
    calibratedRef.current = false;
    setArmed(false);
    setCallout(false);
    setMicReady(false);
    setShowFallback(false);
    setBurst(false);
    setRevealed(false);
    setOut(false);
    clearCheer();
    const cake = cakeRef.current;
    if (cake) {
      cake.style.setProperty("--blow", "0");
      cake.style.setProperty("--p", "0");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
    later(playSong, 600);
    armSafety(600);
    blow.start(); // inside the tap, so the mic and sound are allowed again
  };

  /* Show tap-fallback (only once the song is over): straight away if the mic
     failed, or after a while if she's trying but it isn't working */
  useEffect(() => {
    if (out || !armed) return;
    // If mic failed immediately, show fallback right away
    if (["denied", "insecure", "unsupported"].includes(blow.status)) {
      setShowFallback(true);
      return;
    }
    if (blow.status !== "listening") return;
    const id = setTimeout(() => setShowFallback(true), BLOW.FALLBACK_AFTER_MS);
    return () => clearTimeout(id);
  }, [blow.status, out, armed]);

  useEffect(() => () => {
    timers.current.forEach(clearTimeout);
    audioRef.current?.dispose();
    playerRef.current?.dispose();
  }, []);

  const toggleMute = () =>
    setMuted((m) => {
      audioRef.current?.setMuted(!m);
      playerRef.current?.setMuted(!m);
      return !m;
    });

  const song = useMemo(() => (name ? buildSong(name) : null), [name]);

  function playSong() {
    if (!playerRef.current || !song) return;
    playerRef.current.play(song);
    setSongDone(false);
    setSongRun((n) => n + 1);
  }

  const songEnded = useCallback(() => {
    setSongDone(true);
    arm();
  }, [arm]);

  if (!age || !phase) return <div className="boot" />;

  // On the day itself the "next" birthday is a year away, so count from today.
  const turning  = locked ? target.getFullYear() - dob.y : age.years;
  const candles  = Math.min(Math.max(turning, 1), CAKE.maxCandles);
  const micFailed = ["denied", "insecure", "unsupported"].includes(blow.status);
  const canTap    = armed && !out && (micFailed || showFallback);
  const promptTxt = promptFor(blow.status, out, micReady, armed);

  return (
    <>
      <Backdrop />

      {phase === "cover" && (
        <WelcomeScreen
          name={name}
          turning={turning}
          target={target}
          locked={locked}
          canOpen={!locked || COVER.allowEarlyOpen}
          onUnlock={unlock}
          leaving={started}
          onStart={handleStart}
        />
      )}

      {phase === "celebration" && (
        <main className="screen scene">

          <header className="scene__header">
            <h1 className="scene__name">{name}</h1>
            <p className="scene__sub">
              {revealed ? `Happy ${ordinal(turning)} birthday` : `${ordinal(turning)} birthday`}
            </p>
          </header>

          {/* ── Sing-along line ── */}
          <SongLyrics
            song={song}
            player={player}
            runId={songRun}
            done={songDone}
            onEnd={songEnded}
            onReplay={playSong}
          />

          {/* ── Cake ── */}
          <div className="cake-stage">
            <Cake
              candles={candles}
              number={String(turning)}
              boardName={PERSON.cakeName || name}
              out={out}
              cakeRef={cakeRef}
            />
            {!out && <BlowCheer cheer={cheer} />}
            {callout && (
              <div className="blow-call" role="status">
                <span className="blow-call__text">Blow out the candles!</span>
              </div>
            )}
          </div>

          {/* ── Blow prompt ── */}
          <div className={`prompt ${out ? "prompt--done" : ""}`}>
            {promptTxt && <p className="prompt__text">{promptTxt}</p>}

            {blow.status === "listening" && armed && !out && (
              <>
                <div className="meter" aria-hidden="true">
                  <span ref={liveRef}  className="meter__live" />
                  <span ref={meterRef} className="meter__fill" />
                </div>
                {micReady && <p className="mic-hint">Hold the phone close and blow steadily</p>}
              </>
            )}

            {canTap && (
              <button type="button" className="btn-outline" onClick={celebrate} id="blow-btn">
                Blow out the candles
              </button>
            )}
          </div>

          {/* ── Post-blow reveal ── */}
          <div className={`reveal ${revealed ? "reveal--on" : ""}`}>
            {revealed && (
              <>
                <p className="reveal__wish">{COPY.wish}</p>
                <button type="button" className="again-link" onClick={tryAgain} id="try-again-btn">
                  Try again
                </button>
              </>
            )}
          </div>

        </main>
      )}

      {burst && <BirthdayBurst name={name} turning={turning} onDone={burstDone} />}

      {/* Mute button */}
      {started && phase === "celebration" && (
        <button
          type="button"
          className="mute"
          onClick={toggleMute}
          aria-label={muted ? "Unmute music" : "Mute music"}
          aria-pressed={muted}
          id="mute-btn"
        >
          {muted ? (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M4 9v6h4l5 4V5L8 9H4Z" strokeLinejoin="round" />
              <path d="M17 9.5l4 5M21 9.5l-4 5" strokeLinecap="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M4 9v6h4l5 4V5L8 9H4Z" strokeLinejoin="round" />
              <path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11" strokeLinecap="round" />
            </svg>
          )}
        </button>
      )}

      {/* Gift request: floating WhatsApp button, once the candles are out */}
      {phase === "celebration" && revealed && (
        <a
          className="wa-fab"
          href={whatsappLink()}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Request your gift on WhatsApp"
          title="Request your gift"
          id="whatsapp-gift-btn"
        >
          <WAIcon />
        </a>
      )}
    </>
  );
}
