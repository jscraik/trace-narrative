import { Store } from '@tauri-apps/plugin-store';

const TRACE_SIGNAL_ENABLED_KEY = 'trace.enabled';

/**
 * Detect if running in Tauri runtime environment
 */
function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  const tauriWindow = window as {
    __TAURI_INTERNALS__?: { invoke?: unknown };
    __TAURI_IPC__?: unknown;
  };
  return Boolean(tauriWindow.__TAURI_INTERNALS__?.invoke || tauriWindow.__TAURI_IPC__);
}

/**
 * Tauri Store singleton for settings persistence
 * Uses lazy initialization to avoid top-level await issues
 */
let store: Store | null = null;

function getBrowserStorage():
  | Pick<Storage, 'getItem' | 'setItem'>
  | null {
  // Vitest/jsdom may surface Node's experimental WebStorage getter warnings
  // when accessing window.localStorage; skip browser storage entirely in tests.
  if (typeof process !== 'undefined' && process.env.VITEST) {
    return null;
  }

  if (typeof window === 'undefined') return null;
  const maybeStorage = (window as { localStorage?: unknown }).localStorage;
  if (!maybeStorage || typeof maybeStorage !== 'object') return null;

  const storageLike = maybeStorage as Partial<Pick<Storage, 'getItem' | 'setItem'>>;
  if (typeof storageLike.getItem !== 'function' || typeof storageLike.setItem !== 'function') {
    return null;
  }

  return storageLike as Pick<Storage, 'getItem' | 'setItem'>;
}

async function getStore(): Promise<Store> {
  if (!store) {
    store = await Store.load('settings.json');
  }
  return store;
}

/**
 * Trace signal settings
 */
export interface TraceSettings {
  /** Whether the trace signal is enabled */
  enabled: boolean;
}

/**
 * Get trace settings from persistent storage
 * Falls back to localStorage when not in Tauri environment (e.g., Playwright/browser)
 * @returns Trace settings with defaults applied
 */
export async function getTraceSettings(): Promise<TraceSettings> {
  // Fallback to localStorage when not in Tauri (e.g., browser/Playwright)
  if (!isTauriRuntime()) {
    const storage = getBrowserStorage();
    if (!storage) {
      return { enabled: true };
    }
    try {
      const stored = storage.getItem(TRACE_SIGNAL_ENABLED_KEY);
      const enabled = stored === null ? true : stored === 'true';
      return { enabled };
    } catch (error) {
      console.error('[TraceSettings] Failed to read from localStorage:', error);
      return { enabled: true }; // Default on error
    }
  }

  try {
    const s = await getStore();
    const enabled = await s.get<boolean>(TRACE_SIGNAL_ENABLED_KEY);
    return {
      enabled: enabled ?? true, // Default to enabled
    };
  } catch (error) {
    console.error('[TraceSettings] Failed to load settings:', error);
    throw error;
  }
}

/**
 * Update trace enabled state in persistent storage
 * Falls back to localStorage when not in Tauri environment (e.g., Playwright/browser)
 * @param enabled - Whether to enable the trace signal
 */
export async function setTraceEnabled(enabled: boolean): Promise<void> {
  // Fallback to localStorage when not in Tauri (e.g., browser/Playwright)
  if (!isTauriRuntime()) {
    const storage = getBrowserStorage();
    if (!storage) return;
    try {
      storage.setItem(TRACE_SIGNAL_ENABLED_KEY, String(enabled));
      return;
    } catch (error) {
      console.error('[TraceSettings] Failed to write to localStorage:', error);
      throw error;
    }
  }

  try {
    const s = await getStore();
    await s.set(TRACE_SIGNAL_ENABLED_KEY, enabled);
    await s.save(); // Immediate persistence
  } catch (error) {
    console.error('[TraceSettings] Failed to save settings:', error);
    throw error;
  }
}
