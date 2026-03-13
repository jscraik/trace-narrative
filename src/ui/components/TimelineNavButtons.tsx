import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface TimelineNavButtonsProps {
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}

export function TimelineNavButtons({ hasPrev, hasNext, onPrev, onNext }: TimelineNavButtonsProps) {
  return (
    <>
      <button
        type="button"
        disabled={!hasPrev}
        className="flex items-center justify-center w-8 h-8 rounded-lg border border-border-light bg-bg-tertiary text-text-tertiary hover:bg-bg-hover hover:text-text-secondary transition duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] active:duration-75 active:bg-border-light active:scale-[0.98] hover:scale-110 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-bg-tertiary disabled:hover:text-text-tertiary disabled:hover:scale-100"
        onClick={onPrev}
        aria-label="Previous commit"
        title="Previous commit (Left Arrow)"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <button
        type="button"
        disabled={!hasNext}
        className="flex items-center justify-center w-8 h-8 rounded-lg border border-border-light bg-bg-tertiary text-text-tertiary hover:bg-bg-hover hover:text-text-secondary transition duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] active:duration-75 active:bg-border-light active:scale-[0.98] hover:scale-110 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-bg-tertiary disabled:hover:text-text-tertiary disabled:hover:scale-100"
        onClick={onNext}
        aria-label="Next commit"
        title="Next commit (Right Arrow)"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </>
  );
}
