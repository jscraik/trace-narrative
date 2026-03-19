import { useTheme } from "@design-studio/tokens";
import { Toggle } from "../Toggle";

interface AppearanceCardProps {
	fireflyEnabled?: boolean;
	onToggleFirefly?: (enabled: boolean) => void;
}

export function AppearanceCard({
	fireflyEnabled,
	onToggleFirefly,
}: AppearanceCardProps) {
	const { theme, setTheme } = useTheme();

	return (
		<div className="card p-4">
			<div className="section-header">Appearance</div>
			<div className="section-subheader mt-0.5">visual preferences</div>

			<div className="mt-4 flex flex-col gap-4">
				<div className="flex items-center justify-between">
					<div className="flex flex-col gap-0.5">
						<span className="text-xs font-medium text-text-secondary">
							Theme override
						</span>
						<span className="text-[0.625rem] text-text-tertiary">
							Force dark/light mode for testing
						</span>
					</div>
					<div className="flex items-center gap-2">
						<span className="text-[0.625rem] font-medium text-text-tertiary uppercase tracking-wider">
							{theme === "dark" ? "Dark" : "Light"}
						</span>
						<Toggle
							checked={theme === "dark"}
							onCheckedChange={(checked) =>
								setTheme(checked ? "dark" : "light")
							}
							aria-label="Toggle dark mode"
						/>
					</div>
				</div>

				{onToggleFirefly ? (
					<div className="flex items-center justify-between border-t border-border-subtle/50 pt-3">
						<div className="flex flex-col gap-0.5">
							<span className="text-xs font-medium text-text-secondary">
								Firefly Signal
							</span>
							<span className="text-[0.625rem] text-text-tertiary">
								Ambient status indicator
							</span>
						</div>
						<Toggle
							checked={fireflyEnabled ?? true}
							onCheckedChange={onToggleFirefly}
							aria-label="Toggle firefly signal"
						/>
					</div>
				) : null}

				<div
					className={`border-t border-border-subtle/50 pt-3 ${onToggleFirefly ? "" : "mt-0"}`}
				>
					<div className="text-xs font-medium text-text-secondary mb-2">
						Color Semantics
					</div>
					<div className="flex flex-wrap gap-2 text-[0.6875rem] font-medium">
						<span className="rounded-full border border-accent-green-light bg-accent-green-bg px-2 py-0.5 text-accent-green">
							AI
						</span>
						<span className="rounded-full border border-accent-violet-light bg-accent-violet-bg px-2 py-0.5 text-accent-violet">
							Human
						</span>
						<span className="rounded-full border border-accent-amber-light bg-accent-amber-bg px-2 py-0.5 text-accent-amber">
							Mixed
						</span>
						<span className="rounded-full border border-border-subtle bg-bg-tertiary px-2 py-0.5 text-text-tertiary">
							Unknown
						</span>
						<span className="rounded-full border border-accent-red-light bg-accent-red-bg px-2 py-0.5 text-accent-red">
							Failed tests
						</span>
					</div>
					<div className="mt-2 text-[0.6875rem] text-text-tertiary">
						Session link lifecycle:{" "}
						<span className="text-text-secondary">Imported</span> →{" "}
						<span className="text-accent-amber">Matching</span> →{" "}
						<span className="text-accent-green">Linked</span>{" "}
						<span className="text-text-muted">(or Needs review)</span>
					</div>
				</div>
			</div>
		</div>
	);
}
