import {
  TRACE_ANALYZING_DWELL_MS,
  TRACE_INSIGHT_DWELL_MS,
  TRACE_PRECEDENCE,
  TRACE_TRANSITION_MATRIX,
  useTraceSignal,
  type TraceEvent,
  type TraceLoader,
  type TraceStateType,
  type UseTraceSignalOptions,
  type UseTraceSignalReturn,
} from './useTraceSignal';

export const FIREFLY_ANALYZING_DWELL_MS = TRACE_ANALYZING_DWELL_MS;
export const FIREFLY_INSIGHT_DWELL_MS = TRACE_INSIGHT_DWELL_MS;
export const FIREFLY_PRECEDENCE = TRACE_PRECEDENCE;
export const FIREFLY_TRANSITION_MATRIX = TRACE_TRANSITION_MATRIX;

export type FireflyStateType = TraceStateType;
export type FireflyLoader = TraceLoader;
export type FireflyEvent = TraceEvent;
export type UseFireflyOptions = UseTraceSignalOptions;
export type UseFireflyReturn = UseTraceSignalReturn;

export const useFirefly = useTraceSignal;
