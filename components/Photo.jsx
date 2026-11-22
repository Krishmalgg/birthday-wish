"use client";

import { useState } from "react";

/**
 * <img> that quietly falls back to a generated placeholder when the real photo
 * isn't there yet, so /public/images can be filled in later.
 */
export default function Photo({ src, fallback, alt = "", className, onMissing, ...rest }) {
  const [current, setCurrent] = useState(src);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={current}
      alt={alt}
      className={className}
      draggable={false}
      onError={() => {
        if (fallback && current !== fallback) setCurrent(fallback);
        else onMissing?.();
      }}
      {...rest}
    />
  );
}
