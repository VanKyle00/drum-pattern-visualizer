import type { Shape } from "./project";
import type { Scene } from "./scene";
export function shapePath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  shape: Shape,
) {
  ctx.beginPath();
  if (shape === "circle") ctx.arc(x, y, r, 0, Math.PI * 2);
  else if (shape === "square")
    ctx.roundRect(x - r, y - r, 2 * r, 2 * r, r * 0.12);
  else if (shape === "diamond") {
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r, y);
    ctx.closePath();
  } else {
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r * 0.866, y + r * 0.5);
    ctx.lineTo(x - r * 0.866, y + r * 0.5);
    ctx.closePath();
  }
}
export function drawScene(ctx: CanvasRenderingContext2D, scene: Scene) {
  ctx.save();
  ctx.clearRect(0, 0, scene.width, scene.height);
  ctx.fillStyle = scene.background;
  ctx.fillRect(0, 0, scene.width, scene.height);
  for (const m of scene.marks) {
    ctx.fillStyle = m.color;
    if (m.ripple && m.age < 4) {
      ctx.strokeStyle = m.color;
      ctx.lineWidth = Math.max(1, scene.width / 500);
      ctx.globalAlpha = (1 - m.age / 4) * 0.38;
      shapePath(ctx, m.x, m.y, m.radius * (1.15 + m.age * 0.25), m.shape);
      ctx.stroke();
    }
    if (m.particles && m.age < 4) {
      ctx.globalAlpha = 1 - m.age / 4;
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4,
          d = m.radius * (1.35 + m.age * 0.3);
        shapePath(
          ctx,
          m.x + Math.cos(a) * d,
          m.y + Math.sin(a) * d,
          Math.max(2, scene.width * 0.006),
          m.shape,
        );
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    shapePath(ctx, m.x, m.y, m.radius, m.shape);
    ctx.fill();
  }
  ctx.restore();
}
