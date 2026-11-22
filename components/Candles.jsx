import { CAKE } from "@/lib/config";

/**
 * Candles stand on the cake's top face. Up to CAKE.rowMax they form a row
 * (like the reference photo: the middle ones a touch further back); more
 * than that and they spread into a ring. Positions are percentages of the
 * cake's square box, so they stay put at any size.
 */
export function candleLayout(count) {
  const { cy, rx, ry, gap } = CAKE.ring;
  if (count <= 1) return [{ i: 0, x: 50, y: cy - 0.6 }];

  if (count <= CAKE.rowMax) {
    const mid = (count - 1) / 2;
    return Array.from({ length: count }, (_, i) => ({
      i,
      x: 50 + (i - mid) * gap,
      y: cy - 1.2 + Math.abs(i - mid) * 0.9,
    }));
  }

  return Array.from({ length: count }, (_, i) => {
    const angle = -Math.PI / 2 + (i / count) * Math.PI * 2;
    return {
      i,
      x: 50 + Math.cos(angle) * rx,
      y: cy + Math.sin(angle) * ry,
    };
  });
}

export default function Candles({ count }) {
  const list = candleLayout(count).sort((a, b) => a.y - b.y);

  return (
    <div className="candles" aria-hidden="true">
      {list.map(({ i, x, y }, order) => (
        <div
          key={i}
          className="candle"
          style={{ left: `${x}%`, top: `${y}%`, "--d": `${(order % 7) * 0.08}s`, zIndex: order + 1 }}
        >
          <span className="candle__body" />
          <span className="candle__wick" />
          <span className="flame">
            <i className="flame__outer" />
            <i className="flame__inner" />
          </span>
          <span className="smoke" />
          <span className="smoke smoke--b" />
        </div>
      ))}
    </div>
  );
}
