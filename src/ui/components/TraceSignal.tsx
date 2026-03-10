import clsx from 'clsx';
import type { ComponentPropsWithoutRef } from 'react';

export type TraceState = 'idle' | 'tracking' | 'analyzing' | 'insight';

interface TraceProps extends ComponentPropsWithoutRef<'div'> {
    state?: TraceState;
}

export function Trace({ state = 'idle', className, style, ...props }: TraceProps) {
    return (
        <div
            className={clsx('trace', className)}
            data-state={state}
            style={style}
            {...props}
        >
            <div
                className={clsx(
                    'trace-orb',
                    state === 'idle' && 'animate-trace-idle',
                    state === 'tracking' && 'animate-trace-tracking',
                    state === 'analyzing' && 'animate-trace-analyzing',
                    state === 'insight' && 'animate-trace-insight'
                )}
            />
            <div className="trace-wings">
                <div className="trace-wing left" />
                <div className="trace-wing right" />
            </div>
        </div>
    );
}
