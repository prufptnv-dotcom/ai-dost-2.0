export default function ThinkingDot({ label = 'Thinking…', elapsed = 0 }) {
  return (
    <div className="thinking-indicator" role="status" aria-live="polite">
      <span className="thinking-signal" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span className="thinking-copy">
        <strong>{label}</strong>
        <small>{elapsed > 0 ? `${elapsed}s elapsed` : 'Preparing a response'}</small>
      </span>
    </div>
  );
}
