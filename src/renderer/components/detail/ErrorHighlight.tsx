import { useEffect, useState } from 'react';

interface ErrorHighlightProps {
  children: React.ReactNode;
  isHighlighted: boolean;
  onHighlightEnd?: () => void;
}

export const ErrorHighlight: React.FC<ErrorHighlightProps> = ({
  children,
  isHighlighted,
  onHighlightEnd,
}) => {
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (isHighlighted) {
      setAnimating(true);

      const timer = setTimeout(() => {
        setAnimating(false);
        onHighlightEnd?.();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [isHighlighted, onHighlightEnd]);

  return (
    <div
      className={`rounded transition-all duration-[3000ms] ease-out ${
        animating
          ? 'ring-2 ring-red-500 bg-red-500/20'
          : 'ring-0 bg-transparent'
      }`}
    >
      {children}
    </div>
  );
};
