import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AtlasCapabilities,
  AtlasDoctorReport,
  AtlasDoctorRebuildSummary,
  AtlasError,
  AtlasIntrospect,
  AtlasSearchHit,
} from '../../core/atlas-api';
import {
  atlasCapabilities,
  atlasDoctorRebuildDerived,
  atlasDoctorReport,
  atlasIntrospect,
} from '../../core/atlas-api';
import { useAtlasSearch } from '../../hooks/useAtlasSearch';

function formatIsoMaybe(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function formatHitMeta(hit: AtlasSearchHit): string {
  const tool = hit.sessionTool ?? 'Unknown tool';
  const model = hit.sessionModel ? ` · ${hit.sessionModel}` : '';
  const time = hit.sessionImportedAt ? ` · ${formatIsoMaybe(hit.sessionImportedAt)}` : '';
  return `${tool}${model}${time}`;
}

function summarizeObject(obj: unknown): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

type InfoState = {
  loading: boolean;
  error: AtlasError | null;
  capabilities: AtlasCapabilities | null;
  introspect: AtlasIntrospect | null;
  doctor: AtlasDoctorReport | null;
};

export function AtlasSearchPanel(props: { repoId: number | null }) {
  const { repoId } = props;
  const infoRequestVersionRef = useRef(0);
  const rebuildRequestVersionRef = useRef(0);

  const [info, setInfo] = useState<InfoState>({
    loading: false,
    error: null,
    capabilities: null,
    introspect: null,
    doctor: null,
  });

  const [rebuildLoading, setRebuildLoading] = useState(false);
  const [rebuildError, setRebuildError] = useState<AtlasError | null>(null);
  const [rebuildSummary, setRebuildSummary] = useState<AtlasDoctorRebuildSummary | null>(null);

  const {
    query,
    setQuery,
    loading: searchLoading,
    error: searchError,
    results,
    truncated,
    selectedHit,
    selectHit,
    sessionLoading,
    sessionError,
    selectedSession,
    clearSelection,
    refreshSelectedSession,
  } = useAtlasSearch(repoId);

  const refreshInfo = useCallback(async () => {
    if (!repoId) return;
    const requestVersion = infoRequestVersionRef.current + 1;
    infoRequestVersionRef.current = requestVersion;
    const isStaleRequest = () => infoRequestVersionRef.current !== requestVersion;

    setInfo((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const [capEnv, introEnv, doctorEnv] = await Promise.all([
        atlasCapabilities(),
        atlasIntrospect(repoId),
        atlasDoctorReport(repoId),
      ]);
      if (isStaleRequest()) return;

      if (!capEnv.ok) {
        setInfo({ loading: false, error: capEnv.error, capabilities: null, introspect: null, doctor: null });
        return;
      }
      if (!introEnv.ok) {
        setInfo({ loading: false, error: introEnv.error, capabilities: capEnv.value, introspect: null, doctor: null });
        return;
      }
      if (!doctorEnv.ok) {
        setInfo({ loading: false, error: doctorEnv.error, capabilities: capEnv.value, introspect: introEnv.value, doctor: null });
        return;
      }

      setInfo({
        loading: false,
        error: null,
        capabilities: capEnv.value,
        introspect: introEnv.value,
        doctor: doctorEnv.value,
      });
    } catch (e: unknown) {
      if (isStaleRequest()) return;
      setInfo({
        loading: false,
        error: { code: 'INTERNAL', message: e instanceof Error ? e.message : String(e) },
        capabilities: null,
        introspect: null,
        doctor: null,
      });
    }
  }, [repoId]);

  useEffect(() => {
    infoRequestVersionRef.current += 1;
    rebuildRequestVersionRef.current += 1;

    if (!repoId) {
      setInfo({ loading: false, error: null, capabilities: null, introspect: null, doctor: null });
      setRebuildLoading(false);
      setRebuildError(null);
      setRebuildSummary(null);
      return;
    }

    setRebuildLoading(false);
    setRebuildError(null);
    setRebuildSummary(null);
    void refreshInfo();
  }, [repoId, refreshInfo]);

  const handleRebuild = useCallback(async () => {
    if (!repoId) return;
    const requestVersion = rebuildRequestVersionRef.current + 1;
    rebuildRequestVersionRef.current = requestVersion;
    const isStaleRebuild = () => rebuildRequestVersionRef.current !== requestVersion;

    setRebuildLoading(true);
    setRebuildError(null);
    setRebuildSummary(null);

    try {
      // atlas_doctor_rebuild_derived expects args: { request: { repoId } }
      const env = await atlasDoctorRebuildDerived(repoId);
      if (isStaleRebuild()) {
        setRebuildLoading(false);
        return;
      }
      if (!env.ok) {
        setRebuildLoading(false);
        setRebuildError(env.error);
        return;
      }

      setRebuildSummary(env.value);
      setRebuildLoading(false);

      await refreshInfo();
      if (isStaleRebuild()) {
        setRebuildLoading(false);
        return;
      }
      await refreshSelectedSession();
    } catch (e: unknown) {
      if (isStaleRebuild()) {
        setRebuildLoading(false);
        return;
      }
      setRebuildLoading(false);
      setRebuildError({ code: 'INTERNAL', message: e instanceof Error ? e.message : String(e) });
    }
  }, [repoId, refreshInfo, refreshSelectedSession]);

  const capabilitySummary = useMemo(() => {
    if (!info.capabilities) return null;
    const fts5 = info.capabilities.fts5Enabled;
    const ftsReady = info.capabilities.ftsTableReady;
    const derived = info.capabilities.derivedVersion;

    const ftsStr = fts5 ? 'FTS5 enabled' : 'FTS5 disabled';
    const readyStr = ftsReady ? 'FTS table ready' : 'FTS table missing';
    return `${ftsStr} · ${readyStr} · derived: ${derived}`;
  }, [info.capabilities]);

  if (!repoId) {
    return (
      <div className="card p-5">
        <div className="section-header">ATLAS SEARCH</div>
        <div className="mt-2 text-sm text-text-tertiary">Select a repo to use Atlas search.</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="card p-5">
        <div className="section-header">ATLAS SEARCH</div>
        <div className="mt-1 text-xs text-text-tertiary">Search your imported sessions (lexical, prefix-based).</div>

        <div className="mt-3 flex flex-col gap-2">
          <label htmlFor="atlas-search-input" className="text-xs font-medium text-text-secondary">
            Search sessions
          </label>
          <input
            id="atlas-search-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to search…"
            className="w-full rounded-md border border-border-light bg-bg-primary px-3 py-2 text-sm text-text-secondary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent-blue"
            aria-describedby="atlas-search-help"
            autoComplete="off"
            spellCheck={false}
          />
          <div id="atlas-search-help" className="text-xs text-text-tertiary">
            Tip: use a few keywords; results update as you type.
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRebuild}
              disabled={rebuildLoading}
              className="inline-flex items-center gap-2 rounded-md bg-bg-primary px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-border-light disabled:opacity-60"
            >
              {rebuildLoading ? 'Rebuilding…' : 'Rebuild index'}
            </button>

            <button
              type="button"
              onClick={() => void refreshInfo()}
              disabled={info.loading}
              className="inline-flex items-center gap-2 rounded-md bg-bg-primary px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-border-light disabled:opacity-60"
            >
              {info.loading ? 'Refreshing…' : 'Refresh status'}
            </button>

            {selectedHit ? (
              <button
                type="button"
                onClick={clearSelection}
                className="inline-flex items-center gap-2 rounded-md bg-bg-primary px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-border-light"
              >
                Clear selection
              </button>
            ) : null}
          </div>

          {rebuildError ? (
            <div className="mt-2 text-xs text-accent-red">
              Rebuild error: {rebuildError.code}: {rebuildError.message}
            </div>
          ) : null}

          {rebuildSummary ? (
            <div className="mt-2 text-xs text-text-tertiary">Rebuild complete: {summarizeObject(rebuildSummary)}</div>
          ) : null}

          {info.error ? (
            <div className="mt-2 text-xs text-accent-red">
              Atlas status error: {info.error.code}: {info.error.message}
            </div>
          ) : null}

          {capabilitySummary ? <div className="mt-2 text-xs text-text-tertiary">{capabilitySummary}</div> : null}

          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-text-secondary">Capabilities / Introspect / Doctor (raw)</summary>
            <div className="mt-2 grid grid-cols-1 gap-3">
              <pre className="max-h-40 overflow-auto rounded-md bg-bg-primary p-3 text-[11px] text-text-secondary">
                {summarizeObject(info.capabilities)}
              </pre>
              <pre className="max-h-40 overflow-auto rounded-md bg-bg-primary p-3 text-[11px] text-text-secondary">
                {summarizeObject(info.introspect)}
              </pre>
              <pre className="max-h-40 overflow-auto rounded-md bg-bg-primary p-3 text-[11px] text-text-secondary">
                {summarizeObject(info.doctor)}
              </pre>
            </div>
          </details>
        </div>
      </div>

      <div className="card p-5">
        <div className="section-header">RESULTS</div>

        {searchError ? (
          <div className="mt-2 text-xs text-accent-red">
            Search error: {searchError.code}: {searchError.message}
          </div>
        ) : null}

        {searchLoading ? <div className="mt-2 text-sm text-text-tertiary">Searching…</div> : null}

        {!searchLoading && query.trim().length > 0 && results.length === 0 && !searchError ? (
          <div className="mt-2 text-sm text-text-tertiary">No results.</div>
        ) : null}

        {truncated ? <div className="mt-2 text-xs text-text-tertiary">Results truncated by server budget.</div> : null}

        <ul className="mt-3 flex flex-col gap-2" aria-label="Atlas search results">
          {results.map((hit) => {
            const key = `${hit.sessionId}:${hit.chunkUid}`;
            const isSelected = selectedHit?.chunkUid === hit.chunkUid && selectedHit?.sessionId === hit.sessionId;
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => selectHit(hit)}
                  className={[
                    'w-full rounded-md border px-3 py-2 text-left transition-colors',
                    isSelected ? 'border-accent-blue bg-accent-blue-light' : 'border-border-light bg-bg-primary hover:bg-border-light',
                  ].join(' ')}
                >
                  <div className="flex flex-col gap-1">
                    <div className="text-xs font-medium text-text-secondary">{formatHitMeta(hit)}</div>
                    <div className="text-[11px] text-text-tertiary">Chunk {hit.chunkIndex} · score {hit.score.toFixed(2)}</div>
                    <div className="text-xs text-text-tertiary whitespace-pre-wrap break-words">{hit.snippet || '(no snippet)'}</div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {selectedHit ? (
        <div className="card p-5">
          <div className="section-header">SESSION PREVIEW</div>
          <div className="mt-1 text-xs text-text-tertiary">
            Selected: {selectedHit.sessionId} · {selectedHit.chunkUid}
          </div>

          {sessionError ? (
            <div className="mt-2 text-xs text-accent-red">
              Load error: {sessionError.code}: {sessionError.message}
            </div>
          ) : null}

          {sessionLoading ? <div className="mt-2 text-sm text-text-tertiary">Loading session…</div> : null}

          {!sessionLoading && selectedSession ? (
            <div className="mt-3 flex flex-col gap-3">
              <div className="text-xs text-text-secondary">
                <span className="font-medium">{selectedSession.session.tool}</span>
                {selectedSession.session.model ? ` · ${selectedSession.session.model}` : ''}
                {selectedSession.session.importedAt ? ` · ${formatIsoMaybe(selectedSession.session.importedAt)}` : ''}
                {selectedSession.session.durationMin != null ? ` · ${selectedSession.session.durationMin} min` : ''}
                {selectedSession.session.messageCount != null ? ` · ${selectedSession.session.messageCount} msgs` : ''}
                {selectedSession.session.purgedAt ? ` · purged ${formatIsoMaybe(selectedSession.session.purgedAt)}` : ''}
              </div>

              <div className="flex flex-col gap-2">
                {selectedSession.chunks.map((c) => (
                  <div key={c.chunkUid} className="rounded-md border border-border-light bg-bg-primary p-3">
                    <div className="text-[11px] text-text-tertiary">
                      Chunk {c.chunkIndex} · {c.roleMask}
                    </div>
                    <div className="mt-1 text-xs text-text-secondary whitespace-pre-wrap break-words">{c.text}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
