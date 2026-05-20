export default function PlateNumber({ value, className = '' }: { value?: string; className?: string }) {
  return (
    <span dir="ltr" className={`plate-number ${className}`}>
      {value || '—'}
    </span>
  );
}
