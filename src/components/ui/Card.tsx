import type { HTMLAttributes } from 'react';

type CardProps = HTMLAttributes<HTMLDivElement> & {
  interactive?: boolean;
};

export default function Card({ className = '', interactive, ...props }: CardProps) {
  return (
    <div
      className={`glass-card rounded-2xl ${interactive ? 'transition duration-300 ease-out hover:-translate-y-1 hover:border-white/14 hover:shadow-[0_24px_70px_rgba(0,0,0,.38)]' : ''} ${className}`}
      {...props}
    />
  );
}
