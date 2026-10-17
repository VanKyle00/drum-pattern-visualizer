export default function Timeline({
  time,
  duration,
  playing,
  onSeek,
  onPlayingChange,
}: {
  time: number;
  duration: number;
  playing: boolean;
  onSeek: (t: number) => void;
  onPlayingChange: (v: boolean) => void;
}) {
  return (
    <div className="transport">
      <button
        className="play"
        disabled={duration <= 0}
        onClick={() => onPlayingChange(!playing)}
        aria-label={playing ? "Pause preview" : "Play preview"}
      >
        {playing ? "Ⅱ" : "▶"}
      </button>
      <span className="time">
        {time.toFixed(2)} <small>/ {duration.toFixed(2)} s</small>
      </span>
      <input
        aria-label="Playhead"
        type="range"
        min={0}
        max={duration || 1}
        step={0.001}
        value={Math.min(time, duration)}
        disabled={duration <= 0}
        onChange={(e) => {
          onPlayingChange(false);
          onSeek(Number(e.target.value));
        }}
      />
      <span className="hint">Silent preview</span>
    </div>
  );
}
