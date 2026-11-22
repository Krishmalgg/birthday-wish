"use client";

import { useEffect, useState } from "react";
import { CAKE } from "@/lib/config";
import Cake3D from "./Cake3D";
import CakeArt from "./CakeArt";
import Candles from "./Candles";

/**
 * Which cake is shown:
 *   1. /public/images/cake.png if it exists (with CSS candles on top)
 *   2. otherwise the real-time 3D cake (three.js), faded in once it's ready
 *   3. the drawn SVG cake only if WebGL isn't available
 *
 * Flame state comes from the parent through the DOM (cheap, every frame):
 *   data-blowing="true" → flames thrash
 *   --blow / --p        → bend back and dim with breath strength / hold progress
 *   .cake--out          → flames go out and smoke rises
 */
export default function Cake({ candles, number, boardName, out, cakeRef }) {
  const [photo, setPhoto] = useState(null);
  const [mode, setMode] = useState("loading"); // loading | 3d | svg

  useEffect(() => {
    const img = new Image();
    img.onload = () => setPhoto(CAKE.photo);
    img.src = CAKE.photo;
  }, []);

  const use3D = !photo && mode !== "svg";
  const showDrawn = !photo && mode === "svg";

  return (
    <div ref={cakeRef} className={`cake cake--${photo ? "photo" : mode} ${out ? "cake--out" : ""}`} data-blowing="false">
      <span className="cake__halo" aria-hidden="true" />
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="cake__photo" src={photo} alt="Birthday cake" draggable={false} />
      )}
      {showDrawn && <CakeArt />}
      {(photo || showDrawn) && <Candles count={candles} />}
      {use3D && (
        <Cake3D
          candles={candles}
          number={number}
          message={boardName ? `Happy Birthday ${boardName}` : ""}
          out={out}
          hostRef={cakeRef}
          onReady={() => setMode("3d")}
          onFail={() => setMode("svg")}
        />
      )}
    </div>
  );
}
