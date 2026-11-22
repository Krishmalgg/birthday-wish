"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BLOW } from "@/lib/config";

/**
 * Detects blowing into the microphone with the Web Audio API.
 *
 * Blowing produces loud, noisy, LOW-frequency energy, so each frame we average
 * the first BLOW.LOW_BINS bins of the FFT. The first ~0.8s is spent listening
 * to the room: the trigger level is set just above that baseline, which is what
 * makes this work on a quiet laptop and a noisy phone without hand-tuning.
 * Once the level stays above the trigger for BLOW.HOLD_MS, `onBlow` fires; a
 * softer breath only shows up in `strength` (the flames flicker, nothing more).
 *
 * status: idle | requesting | listening | denied | insecure | unsupported
 *
 * `insecure` is the usual one on a phone: browsers only expose a microphone on
 * https or localhost, so http://192.168.x.x shows the tap fallback instead.
 *
 * armed: false → listens (and calibrates) but blowing never counts, e.g. while
 * the birthday song is still playing.
 *
 * start() must be called from a click handler — the AudioContext is created and
 * resumed synchronously, before any await, which iOS Safari insists on.
 */
export function useBlowDetection({ onBlow, onLevel, armed = true }) {
  const [status, setStatus] = useState("idle");
  const callbacks = useRef({ onBlow, onLevel, armed });
  const session = useRef(null);

  useEffect(() => {
    callbacks.current = { onBlow, onLevel, armed };
  });

  const stop = useCallback(() => {
    const s = session.current;
    if (!s) return;
    session.current = null;
    cancelAnimationFrame(s.raf);
    s.stream?.getTracks().forEach((t) => t.stop());
    s.ctx?.close().catch(() => {});
  }, []);

  useEffect(() => stop, [stop]);

  const start = useCallback(async () => {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!navigator.mediaDevices?.getUserMedia || !Ctx) {
      setStatus(window.isSecureContext === false ? "insecure" : "unsupported");
      return false;
    }

    setStatus("requesting");
    const ctx = new Ctx();
    ctx.resume().catch(() => {}); // still inside the user gesture — iOS needs this

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // Blowing is noise, so don't let the browser "clean it up".
        audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false },
      });
      if (ctx.state === "suspended") await ctx.resume();

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.35;
      ctx.createMediaStreamSource(stream).connect(analyser); // never connected to the speakers

      const bins = new Uint8Array(analyser.frequencyBinCount);
      const s = { ctx, stream, raf: 0 };
      session.current = s;

      let held = 0;
      let last = performance.now();
      let fired = false;

      // room calibration
      const calibrateUntil = last + BLOW.CALIBRATE_MS;
      let roomSum = 0;
      let roomFrames = 0;
      let baseline = null;
      let trigger = BLOW.THRESHOLD;

      const tick = (now) => {
        const dt = Math.min(100, now - last);
        last = now;

        analyser.getByteFrequencyData(bins);
        let sum = 0;
        for (let i = 1; i <= BLOW.LOW_BINS; i++) sum += bins[i];
        const avg = sum / BLOW.LOW_BINS;

        if (baseline === null) {
          roomSum += avg;
          roomFrames += 1;
          if (now < calibrateUntil) {
            callbacks.current.onLevel?.({ calibrating: true, blowing: false, intensity: 0, strength: 0, progress: 0 });
            s.raf = requestAnimationFrame(tick);
            return;
          }
          baseline = roomSum / Math.max(1, roomFrames);
          trigger = BLOW.AUTO_CALIBRATE
            ? Math.min(BLOW.MAX_TRIGGER, Math.max(BLOW.MIN_TRIGGER, baseline + BLOW.OVER_ROOM))
            : BLOW.THRESHOLD;
        }

        // until armed (the song is still playing) breath is measured but never counts
        const armedNow = callbacks.current.armed;
        const blowing = armedNow && avg > trigger;
        held = blowing ? held + dt : Math.max(0, held - dt * 1.5);
        const progress = Math.min(1, held / BLOW.HOLD_MS);
        const intensity = Math.min(1, Math.max(0, (avg - baseline) / Math.max(40, 255 - baseline)));
        // 0 = room noise, 1 = just strong enough to count, above 1 = stronger
        const strength = Math.max(0, (avg - baseline) / Math.max(10, trigger - baseline));

        callbacks.current.onLevel?.({ calibrating: false, blowing, intensity, strength, progress });

        if (progress >= 1 && !fired) {
          fired = true;
          stop();
          callbacks.current.onBlow?.();
          return;
        }
        s.raf = requestAnimationFrame(tick);
      };
      s.raf = requestAnimationFrame(tick);

      setStatus("listening");
      return true;
    } catch {
      ctx.close().catch(() => {});
      setStatus(window.isSecureContext === false ? "insecure" : "denied");
      return false;
    }
  }, [stop]);

  return { status, start, stop };
}
