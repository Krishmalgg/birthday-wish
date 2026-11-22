"use client";

import { HERO } from "@/lib/config";
import Countdown from "./Countdown";
import Photo from "./Photo";

const DATE_FMT = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });

const MicIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" strokeLinecap="round" />
  </svg>
);

/**
 * Cover page: photo, "A little something for <name>", the date, a boxed
 * countdown to midnight, the open button and a note about the candles.
 * The tap on the button is the user gesture that unlocks sound and the mic.
 */
export default function WelcomeScreen({ name, turning, target, locked, canOpen, onUnlock, leaving, onStart }) {
  return (
    <section className={`screen cover ${leaving ? "screen--leaving" : ""}`}>
      <div className="cover__photo">
        <Photo src={HERO.src} fallback={HERO.fallback} alt={name} className="cover__img" />
      </div>

      <div className="cover__body">
        <p className="cover__eyebrow">A little something for</p>
        <h1 className="cover__name">{name}</h1>
        <p className="cover__meta">
          {locked ? `turns ${turning} on ${DATE_FMT.format(target)}` : `is ${turning} today`}
        </p>

        <p className="cover__label">{locked ? "The big day is almost here" : "Today is the day"}</p>
        {locked && <Countdown target={target} onComplete={onUnlock} />}

        <button
          type="button"
          className="btn-main"
          onClick={onStart}
          disabled={leaving || !canOpen}
          id="open-surprise-btn"
        >
          {canOpen ? "Open your surprise" : "Opens at midnight"}
        </button>

        <p className="cover__note">
          <MicIcon />
          Get ready to blow out your birthday candles!
        </p>
      </div>
    </section>
  );
}
