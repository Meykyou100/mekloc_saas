import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

export function Field({
  label,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="grid gap-2 text-sm font-medium text-[var(--app-text-soft)]">
      <span>{label}</span>
      <input
        className={`form-control focus-ring w-full text-base sm:text-sm ${className}`}
        {...props}
      />
    </label>
  );
}

export function SelectField({
  label,
  className = '',
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <label className="grid gap-2 text-sm font-medium text-[var(--app-text-soft)]">
      <span>{label}</span>
      <select
        className={`form-control focus-ring w-full text-base sm:text-sm ${className}`}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}

export function TextAreaField({
  label,
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className="grid gap-2 text-sm font-medium text-[var(--app-text-soft)]">
      <span>{label}</span>
      <textarea
        className={`form-control focus-ring min-h-28 w-full text-base sm:text-sm ${className}`}
        {...props}
      />
    </label>
  );
}
