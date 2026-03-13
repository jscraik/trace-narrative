import { ChevronRight, GitBranch, GitCommit } from 'lucide-react';

export interface BreadcrumbSegment {
  label: string;
  href?: string;
  icon?: 'branch' | 'commit';
}

interface BreadcrumbProps {
  segments: BreadcrumbSegment[];
}

export function Breadcrumb({ segments }: BreadcrumbProps) {
  if (segments.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs">
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        const Icon = segment.icon === 'branch' ? GitBranch : segment.icon === 'commit' ? GitCommit : null;

        return (
          <div key={`${segment.label}-${segment.icon}`} className="flex items-center">
            {index > 0 && (
              <ChevronRight className="w-3 h-3 text-text-muted mx-1" aria-hidden="true" />
            )}
            {segment.href && !isLast ? (
              <a
                href={segment.href}
                className="flex items-center gap-1 text-text-secondary hover:text-accent-blue transition-colors"
              >
                {Icon && <Icon className="w-3 h-3" />}
                <span className="truncate max-w-[7.5rem]">{segment.label}</span>
              </a>
            ) : (
              <span
                className={`flex items-center gap-1 ${
                  isLast ? 'text-text-primary font-medium' : 'text-text-secondary'
                }`}
                aria-current={isLast ? 'page' : undefined}
              >
                {Icon && <Icon className="w-3 h-3" />}
                <span className="truncate max-w-[7.5rem]">{segment.label}</span>
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}
