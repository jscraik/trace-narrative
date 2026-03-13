import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ActivityEvent } from '../../core/tauri/activity';
import { Toggle } from './Toggle';

type ActivityFilter = 'all' | 'failed' | 'needs-review' | 'linked';

function formatTime(iso?: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString();
  } catch {
    return '—';
  }
}

function CaptureLifecycleRail({
  recent,
  onSelectFilter,
  activeFilter,
}: {
  recent: ActivityEvent[];
  onSelectFilter?: (filter: ActivityFilter) => void;
  activeFilter?: ActivityFilter;
}) {
  const latestImport = recent.find((e) => e.action === 'auto_import');
  const hasLinkedCommit = Boolean(latestImport?.commitShas && latestImport.commitShas.length > 0);
  const needsReview = Boolean(latestImport?.needsReview);
  const failed = latestImport?.status === 'failed';

  const activeStep = failed ? 2 : hasLinkedCommit ? 3 : latestImport ? 2 : 1;
  const step3Label = failed ? 'Failed' : needsReview ? 'Needs review' : 'Linked';

  const steps = [
    { id: 1, label: 'Imported' },
    { id: 2, label: 'Matching' },
    { id: 3, label: step3Label },
  ] as const;

  return (
    <div className="mt-1">
      <div className="flex flex-wrap items-center gap-1.5">
        {steps.map((step, index) => {
          const complete = step.id < activeStep && !failed;
          const active = step.id === activeStep;
          const dotClass = failed && step.id === 3
            ? 'bg-accent-red border-accent-red'
            : complete
              ? 'bg-accent-green border-accent-green'
              : active
                ? 'bg-accent-amber border-accent-amber'
                : 'bg-bg-tertiary border-border-subtle';

          const textClass = failed && step.id === 3
            ? 'text-accent-red font-semibold'
            : active
              ? 'text-text-secondary font-semibold'
              : 'text-text-muted';

          return (
            <div key={step.id} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full border ${dotClass}`} />
              <span className={`text-[0.625rem] leading-4 ${textClass}`}>{step.label}</span>
              {index < steps.length - 1 ? <span className="h-px w-3 bg-border-light" aria-hidden="true" /> : null}
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {[
          { key: 'linked' as const, label: 'Linked' },
          { key: 'needs-review' as const, label: 'Needs review' },
          { key: 'failed' as const, label: 'Failed' },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelectFilter?.(item.key)}
            className={`rounded-md border px-2 py-0.5 text-[0.625rem] transition duration-200 ease-out active:duration-75 active:scale-[0.98] hover:scale-105 ${activeFilter === item.key
              ? 'border-accent-blue-light bg-accent-blue-bg text-accent-blue'
              : 'btn-tertiary-soft'
              }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function CaptureActivityStrip(props: {
  enabled: boolean;
  sourcesLabel: string;
  issueCount: number;
  captureMode?: 'OTEL_ONLY' | 'HYBRID_ACTIVE' | 'DEGRADED_STREAMING' | 'FAILURE';
  captureModeMessage?: string;
  lastSeenISO?: string;
  recent: ActivityEvent[];
  onToggle?: (enabled: boolean) => void;
  onRequestAll?: () => Promise<ActivityEvent[]>;
}) {
  const { enabled, sourcesLabel, issueCount, captureMode, captureModeMessage, lastSeenISO, recent, onToggle, onRequestAll } = props;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerItems, setDrawerItems] = useState<ActivityEvent[] | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const drawerRequestVersionRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const lastSeen = useMemo(() => formatTime(lastSeenISO), [lastSeenISO]);

  const openDrawer = useCallback(async () => {
    if (!onRequestAll) return;
    const requestVersion = drawerRequestVersionRef.current + 1;
    drawerRequestVersionRef.current = requestVersion;
    const isStaleRequest = () =>
      !isMountedRef.current || drawerRequestVersionRef.current !== requestVersion;

    setDrawerOpen(true);
    setDrawerLoading(true);
    try {
      const items = await onRequestAll();
      if (isStaleRequest()) return;
      setDrawerItems(items);
    } catch {
      if (isStaleRequest()) return;
      setDrawerItems([]);
    } finally {
      if (!isStaleRequest()) {
        setDrawerLoading(false);
      }
    }
  }, [onRequestAll]);

  const closeDrawer = useCallback(() => {
    drawerRequestVersionRef.current += 1;
    setDrawerOpen(false);
    setDrawerLoading(false);
  }, []);

  const filteredItems = useMemo(() => {
    const items = drawerItems ?? [];
    if (activityFilter === 'all') return items;
    return items.filter((e) => {
      if (activityFilter === 'failed') return e.status === 'failed';
      if (activityFilter === 'needs-review') return Boolean(e.needsReview);
      if (activityFilter === 'linked') return Boolean(e.commitShas && e.commitShas.length > 0);
      return true;
    });
  }, [activityFilter, drawerItems]);

  return (
    <>
      <div className="card p-3 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-text-secondary">Capture</div>
            <div className="mt-0.5 text-[0.6875rem] text-text-tertiary">
              {enabled
                ? `On · Sources: ${sourcesLabel || '—'} · Issues: ${issueCount}`
                : 'Off · Turn on to capture sessions and traces automatically.'}
            </div>
            {captureMode ? (
              <div className="mt-1 flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.625rem] font-semibold border ${captureMode === 'HYBRID_ACTIVE'
                    ? 'bg-accent-green-bg text-accent-green border-accent-green-light'
                    : captureMode === 'OTEL_ONLY'
                      ? 'bg-accent-blue-bg text-accent-blue border-accent-blue-light'
                      : captureMode === 'DEGRADED_STREAMING'
                        ? 'bg-accent-amber-bg text-accent-amber border-accent-amber-light'
                        : 'bg-accent-error-warm-bg text-accent-error-warm border-accent-error-warm-light'
                    }`}
                >
                  {captureMode}
                </span>
                {captureModeMessage ? (
                  <span className="text-[0.6875rem] text-text-tertiary">{captureModeMessage}</span>
                ) : null}
              </div>
            ) : null}
            {enabled ? (
              <div className="text-[0.6875rem] text-text-muted">Last seen: {lastSeen}</div>
            ) : null}
            {enabled ? (
              <CaptureLifecycleRail
                recent={recent}
                activeFilter={activityFilter === 'all' ? undefined : activityFilter}
                onSelectFilter={async (filter) => {
                  setActivityFilter((prev) => (prev === filter ? 'all' : filter));
                  await openDrawer();
                }}
              />
            ) : null}
          </div>

          {onToggle ? (
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <span className="text-[0.625rem] font-semibold uppercase tracking-wider text-text-tertiary">
                {enabled ? 'On' : 'Off'}
              </span>
              <Toggle checked={enabled} onCheckedChange={(c) => onToggle(c)} aria-label="Auto-capture" />
            </div>
          ) : null}
        </div>

        <div className="pt-1">
          <div className="flex items-center justify-between">
            <div className="text-[0.6875rem] font-semibold text-text-secondary">Recent</div>
            <button
              type="button"
              className="text-[0.6875rem] text-text-tertiary transition duration-200 ease-out active:duration-75 active:scale-[0.98] hover:text-text-secondary hover:scale-105"
              onClick={openDrawer}
              disabled={!onRequestAll}
            >
              View all
            </button>
          </div>

          {recent.length === 0 ? (
            <div className="mt-2 text-xs text-text-tertiary">No recent capture activity yet.</div>
          ) : (
            <div className="mt-2 flex flex-col gap-1.5">
              {recent.slice(0, 3).map((e) => (
                <div key={e.id} className="text-[0.6875rem] text-text-tertiary">
                  {e.message}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 animate-in fade-in duration-200">
          <button
            type="button"
            className="absolute inset-0 bg-[var(--overlay)]"
            onClick={closeDrawer}
            aria-label="Close"
          />
          <div className="absolute right-0 top-0 h-full w-full max-w-[32.5rem] overflow-y-auto border-l border-border-subtle bg-bg-primary p-5 shadow-xl animate-in slide-in-from-right duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-text-secondary">Capture activity</div>
                <div className="mt-1 text-xs text-text-tertiary">
                  Recent imports and telemetry updates for this repo.
                </div>
              </div>
              <button
                type="button"
                className="btn-secondary-soft text-xs px-3 py-1.5 rounded-md transition duration-200 ease-out active:duration-75 active:scale-[0.98] hover:scale-105"
                onClick={closeDrawer}
              >
                Close
              </button>
            </div>

            <div className="mt-4">
              {drawerLoading ? (
                <div className="text-xs text-text-tertiary">Loading…</div>
              ) : filteredItems.length === 0 ? (
                <div className="text-sm text-text-tertiary">
                  No activity for this filter yet.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {filteredItems.map((e) => (
                    <div key={e.id} className="card p-3">
                      <div className="text-xs text-text-secondary">{e.message}</div>
                      <div className="mt-1 text-[0.6875rem] text-text-tertiary">
                        {formatTime(e.createdAtIso)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
