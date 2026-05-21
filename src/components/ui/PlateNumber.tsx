export default function PlateNumber({ value, className = '' }: { value?: string; className?: string }) {
  return (
    <span dir="ltr" style={{ direction: 'ltr', unicodeBidi: 'isolate', textAlign: 'left' }} className={`plate-number ${className}`}>
      {value || '—'}
    </span>
  );
}
