export default function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-shimmer rounded-xl bg-[linear-gradient(90deg,rgba(255,255,255,.06)_0%,rgba(255,255,255,.14)_50%,rgba(255,255,255,.06)_100%)] bg-[length:700px_100%] ${className}`}
    />
  );
}
