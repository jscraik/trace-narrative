

export type Tone = 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'neutral';

export interface ToneStyles {
  border: string;
  bg: string;
  text: string;
  dot: string;
}

export function getToneStyles(tone: Tone): ToneStyles {
  switch (tone) {
    case 'blue':
      return {
        bg: 'bg-accent-blue-bg',
        border: 'border-accent-blue-light',
        text: 'text-accent-blue',
        dot: 'bg-accent-blue',
      };
    case 'green':
      return {
        bg: 'bg-accent-green-bg',
        border: 'border-accent-green-light',
        text: 'text-accent-green',
        dot: 'bg-accent-green',
      };
    case 'amber':
      return {
        bg: 'bg-accent-amber-bg',
        border: 'border-accent-amber-light',
        text: 'text-accent-amber',
        dot: 'bg-accent-amber',
      };
    case 'red':
      return {
        bg: 'bg-accent-red-bg',
        border: 'border-accent-red-light',
        text: 'text-accent-red',
        dot: 'bg-accent-red',
      };
    case 'violet':
      return {
        bg: 'bg-accent-violet-bg',
        border: 'border-accent-violet-light',
        text: 'text-accent-violet',
        dot: 'bg-accent-violet',
      };
    default:
      return {
        bg: 'bg-bg-subtle',
        border: 'border-border-light',
        text: 'text-text-secondary',
        dot: 'bg-text-tertiary',
      };
  }
}
