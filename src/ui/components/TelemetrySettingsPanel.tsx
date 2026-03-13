import { useEffect, useState } from 'react';
import type { CaptureReliabilityStatus, IngestConfig, OtlpKeyStatus } from '../../core/tauri/ingestConfig';
import type { TraceCollectorConfig } from '../../core/types';
import { HelpPopover } from './HelpPopover';
import { Toggle } from './Toggle';

interface TelemetrySettingsPanelProps {
    traceConfig?: TraceCollectorConfig;
    ingestConfig?: IngestConfig | null;
    captureReliabilityStatus?: CaptureReliabilityStatus | null;
    otlpKeyStatus?: OtlpKeyStatus | null;
    logUserPromptEnabled?: boolean | null;
    logUserPromptConfigPath?: string | null;
    onUpdateCodexOtelPath?: (path: string) => void;
    onToggleCodexOtelReceiver?: (enabled: boolean) => void;
    onOpenCodexOtelDocs?: () => void;
    onRotateOtlpKey?: () => void;
    onGrantConsent?: () => void;
    onConfigureCodex?: () => void;
}

export function TelemetrySettingsPanel({
    traceConfig,
    ingestConfig,
    captureReliabilityStatus,
    otlpKeyStatus,
    logUserPromptEnabled,
    logUserPromptConfigPath,
    onUpdateCodexOtelPath,
    onToggleCodexOtelReceiver,
    onOpenCodexOtelDocs,
    onRotateOtlpKey,
    onGrantConsent,
    onConfigureCodex,
}: TelemetrySettingsPanelProps) {
    const [otelPath, setOtelPath] = useState(traceConfig?.codexOtelLogPath ?? '/tmp/codex-otel.json');
    const [copiedPromptSnippet, setCopiedPromptSnippet] = useState(false);

    useEffect(() => {
        if (!traceConfig?.codexOtelLogPath) return;
        setOtelPath(traceConfig.codexOtelLogPath);
    }, [traceConfig?.codexOtelLogPath]);

    const receiverEnabled = traceConfig?.codexOtelReceiverEnabled ?? false;
    const embeddedReceiverAvailable = Boolean(onToggleCodexOtelReceiver);
    const appServerStreamActive = captureReliabilityStatus?.streamExpected ?? false;
    const showFilePathConfig = (!embeddedReceiverAvailable || !receiverEnabled) && !appServerStreamActive;
    const filePathHiddenReason = appServerStreamActive
        ? {
            icon: '🛰',
            badge: 'App Server stream active',
            message: 'Codex App Server stream is active. File-path OTEL import is hidden.',
            badgeClass: 'border-accent-violet-light bg-accent-violet-bg text-accent-violet',
            dotClass: 'bg-accent-violet',
        }
        : {
            icon: '📥',
            badge: 'Embedded receiver active',
            message: 'Embedded receiver is active. File-path OTEL import is hidden.',
            badgeClass: 'border-accent-amber-light bg-accent-amber-bg text-accent-amber',
            dotClass: 'bg-accent-amber',
        };
    const disablePromptSnippet = 'log_user_prompt = false';
    const hasConsent = ingestConfig?.consent.codexTelemetryGranted ?? false;
    const keyPresent = otlpKeyStatus?.present ?? false;
    const maskedKey = otlpKeyStatus?.maskedPreview ?? (keyPresent ? '********' : null);

    const handleCopyPromptSnippet = async () => {
        try {
            await navigator.clipboard.writeText(disablePromptSnippet);
            setCopiedPromptSnippet(true);
            setTimeout(() => setCopiedPromptSnippet(false), 1500);
        } catch {
            setCopiedPromptSnippet(false);
        }
    };

    if (!traceConfig && !ingestConfig) {
        return (
            <div className="card p-5">
                <div className="section-header">Telemetry Connection</div>
                <div className="section-subheader">codex & otel</div>
                <div className="mt-4 text-xs text-text-tertiary">Open a repo to configure telemetry settings.</div>
            </div>
        );
    }

    return (
        <div className="card p-5">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <div className="section-header">Telemetry Connection</div>
                    <div className="section-subheader">codex & otel</div>
                </div>
                {onOpenCodexOtelDocs ? (
                    <button
                        type="button"
                        className="inline-flex items-center rounded-md border border-accent-blue-light bg-accent-blue-bg px-2.5 py-1 text-[0.6875rem] font-semibold text-accent-blue transition-colors hover:bg-accent-blue-light"
                        onClick={onOpenCodexOtelDocs}
                        aria-label="Open Codex OTel setup guide"
                    >
                        Setup Guide
                    </button>
                ) : null}
            </div>

            <div className="mt-4 flex flex-col gap-4">
                {/* Codex Telemetry Section */}
                <div className="rounded-lg border border-border-subtle bg-bg-secondary p-3">
                    <div className="flex items-center justify-between mb-1">
                        <div className="text-xs font-semibold text-text-secondary">Codex Telemetry</div>
                        <HelpPopover content="Enables exporting telemetry data to a local OTel receiver." />
                    </div>
                    <div className="mb-3 text-[0.6875rem] text-text-tertiary">
                        Uses a local OTLP receiver with an API key stored securely on this machine.
                    </div>

                    {!hasConsent ? (
                        <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-bg-tertiary p-2 border border-border-subtle">
                            <span className="text-xs text-text-secondary">I consent to enabling Codex telemetry export</span>
                            <Toggle checked={false} onCheckedChange={(_c) => onGrantConsent?.()} aria-label="Grant Codex telemetry consent" />
                        </div>
                    ) : (
                        <div className="mt-2 text-xs text-accent-green font-medium flex items-center gap-1">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent-green" />
                            Consent granted
                        </div>
                    )}

                    <div className="mt-3 flex items-center justify-between text-[0.6875rem] text-text-tertiary">
                        <span>Receiver key: <span className="font-mono text-text-secondary">{maskedKey ?? 'not set'}</span></span>
                        <button
                            type="button"
                            className="text-accent-blue hover:underline disabled:opacity-50 disabled:no-underline"
                            onClick={onRotateOtlpKey}
                            disabled={!hasConsent}
                            title="Rotate the local receiver key"
                        >
                            Rotate
                        </button>
                    </div>

                    <div className="mt-3">
                        <button
                            type="button"
                            className="inline-flex items-center rounded-md border border-accent-blue-light bg-accent-blue-bg px-2 py-1 text-[0.6875rem] font-semibold text-accent-blue hover:bg-accent-blue-light disabled:opacity-50"
                            onClick={onConfigureCodex}
                            disabled={!hasConsent}
                        >
                            Configure Codex telemetry
                        </button>
                    </div>
                </div>

                {/* OTel Receiver Log Path Section */}
                <div className="rounded-lg border border-border-light bg-bg-tertiary p-3">
                    {showFilePathConfig ? (
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label htmlFor="codex-otel-path" className="text-xs font-semibold text-text-secondary">
                                    Codex OTel log file path
                                </label>
                                <HelpPopover content="Path to the JSON log file where OTel traces are written." />
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <input
                                    id="codex-otel-path"
                                    type="text"
                                    value={otelPath}
                                    onChange={(event) => setOtelPath(event.target.value)}
                                    className="min-w-[13.75rem] flex-1 rounded-md border border-border-light bg-bg-secondary px-2 py-1 text-xs text-text-secondary outline-none focus:border-border-medium"
                                    placeholder="/tmp/codex-otel.json"
                                />
                                <button
                                    type="button"
                                    className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-semibold transition duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${otelPath.trim() && otelPath !== (traceConfig?.codexOtelLogPath ?? '/tmp/codex-otel.json')
                                            ? 'border-accent-blue-light bg-accent-blue-bg text-accent-blue hover:bg-accent-blue-light'
                                            : 'border-border-light bg-bg-secondary text-text-secondary hover:bg-bg-hover'
                                        }`}
                                    onClick={() => onUpdateCodexOtelPath?.(otelPath.trim())}
                                    disabled={!otelPath.trim()}
                                >
                                    Sync
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-md border border-border-subtle bg-bg-secondary px-3 py-2 text-[0.6875rem] text-text-tertiary">
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.625rem] font-semibold ${filePathHiddenReason.badgeClass}`}>
                                <span aria-hidden="true">{filePathHiddenReason.icon}</span>
                                <span className={`inline-block h-1.5 w-1.5 rounded-full ${filePathHiddenReason.dotClass}`} aria-hidden="true" />
                                {filePathHiddenReason.badge}
                            </span>
                            <div className="mt-1">{filePathHiddenReason.message}</div>
                        </div>
                    )}

                    {onToggleCodexOtelReceiver ? (
                        <div className="flex items-center justify-between pt-2 mt-3 border-t border-border-subtle/50">
                            <div className="flex flex-col gap-0.5">
                                <span className="text-xs font-medium text-text-secondary">Embedded OTel receiver</span>
                                <span className="text-[0.625rem] text-text-tertiary">Runs a local OTLP receiver (port 4318)</span>
                            </div>
                            <Toggle checked={receiverEnabled} onCheckedChange={(c) => onToggleCodexOtelReceiver(c)} aria-label="Embedded Codex OTel receiver (local)" />
                        </div>
                    ) : null}

                    {logUserPromptEnabled ? (
                        <div className="mt-3 rounded-md border border-accent-amber-light bg-accent-amber-bg px-3 py-2 text-xs text-text-secondary">
                            <div className="font-semibold text-accent-amber flex items-center gap-2">
                                <span>Raw prompt export ON</span>
                                <HelpPopover content="Full prompt text is visible in logs. This is great for debugging but risky for sensitive data." />
                            </div>
                            {logUserPromptConfigPath ? (
                                <div className="mt-1 inline-block rounded bg-bg-tertiary px-1 py-0.5 font-mono text-[0.6875rem] text-text-secondary">
                                    {logUserPromptConfigPath}
                                </div>
                            ) : null}
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleCopyPromptSnippet}
                                    className="inline-flex items-center rounded-md border border-accent-amber-light bg-bg-secondary px-2 py-1 text-[0.6875rem] font-semibold text-accent-amber hover:bg-accent-amber-light"
                                >
                                    {copiedPromptSnippet ? 'Snippet copied' : 'Copy disable snippet'}
                                </button>
                                <span className="font-mono text-[0.6875rem] text-text-secondary">{disablePromptSnippet}</span>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
