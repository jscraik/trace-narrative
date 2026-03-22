import clsx from "clsx";
import { Cpu, FolderGit2, Key, Monitor } from "lucide-react";
import type { Mode } from "../../core/types";
import { SectionHeader } from "../components/SectionHeader";

interface SettingsViewProps {
	onModeChange: (mode: Mode) => void;
	onOpenRepo: () => void;
	onImportSession?: () => void;
}

function SettingsSection({
	title,
	icon: Icon,
	children,
	description,
}: {
	title: string;
	icon?: React.ElementType;
	children: React.ReactNode;
	description?: string;
}) {
	return (
		<section className="flex flex-col gap-5 rounded-3xl border border-border-subtle bg-bg-primary p-6 shadow-sm">
			<div className="flex items-center gap-3">
				{Icon && (
					<div className="flex h-8 w-8 items-center justify-center rounded-xl bg-bg-secondary text-text-secondary">
						<Icon className="h-4 w-4" />
					</div>
				)}
				<div className="flex flex-col">
					<h3 className="text-lg font-medium tracking-tight text-text-primary">
						{title}
					</h3>
					{description && (
						<p className="text-sm text-text-muted mt-0.5">{description}</p>
					)}
				</div>
			</div>
			<div className="pl-0 md:pl-11">{children}</div>
		</section>
	);
}

function ToggleRow({
	label,
	description,
	checked,
}: {
	label: string;
	description?: string;
	checked: boolean;
}) {
	return (
		<div className="flex items-center justify-between gap-4 rounded-xl border border-transparent hover:border-border-subtle bg-transparent hover:bg-bg-subtle p-3 transition-colors">
			<div className="flex flex-col gap-0.5">
				<span className="text-sm font-medium text-text-primary">{label}</span>
				{description && (
					<span className="text-xs text-text-muted">{description}</span>
				)}
			</div>
			<button
				type="button"
				className={clsx(
					"relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
					checked
						? "bg-accent-violet"
						: "bg-bg-tertiary hover:bg-border-subtle",
				)}
				role="switch"
				aria-checked={checked}
			>
				<span
					aria-hidden="true"
					className={clsx(
						"pointer-events-none inline-block h-4 w-4 transform rounded-full bg-text-primary shadow ring-0 transition duration-200 ease-in-out",
						checked
							? "translate-x-[1rem] border-bg-primary"
							: "translate-x-0 border-border-strong",
					)}
				/>
			</button>
		</div>
	);
}

function InputRow({
	label,
	value,
	type = "text",
	masked = false,
}: {
	label: string;
	value: string;
	type?: string;
	masked?: boolean;
}) {
	return (
		<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 rounded-xl border border-transparent hover:border-border-subtle bg-transparent hover:bg-bg-subtle p-3 transition-colors">
			<span className="text-sm font-medium text-text-primary whitespace-nowrap">
				{label}
			</span>
			<input
				type={masked ? "password" : type}
				defaultValue={value}
				readOnly
				className="w-full sm:max-w-60 rounded-lg border border-border-subtle bg-bg-primary px-3 py-1.5 text-sm text-text-secondary focus:border-accent-violet focus:outline-none focus:ring-1 focus:ring-accent-violet transition-shadow"
			/>
		</div>
	);
}

export function SettingsView(_props: SettingsViewProps) {
	return (
		<div className="flex h-full min-h-0 flex-col bg-bg-secondary">
			<main className="flex-1 overflow-y-auto px-6 py-10 shadow-inner">
				<div className="mx-auto flex max-w-4xl flex-col gap-8">
					<SectionHeader
						title={<>Settings</>}
						description="Configure how Trace captures and indexes context."
					/>

					<SettingsSection
						icon={FolderGit2}
						title="Scan Roots"
						description="Directories where Trace attempts to automatically discover and index repositories. Search depth is limited to 3 levels."
					>
						<div className="flex flex-col gap-2">
							<div className="flex items-center justify-between rounded-lg border border-border-subtle bg-bg-primary p-3 shadow-xs">
								<span className="text-sm font-mono text-text-secondary">
									~/dev/
								</span>
								<span className="rounded-md bg-accent-green-bg/50 px-2 py-0.5 text-[0.6875rem] font-medium text-accent-green border border-accent-green/20">
									ACTIVE
								</span>
							</div>
							<div className="flex items-center justify-between rounded-lg border border-border-subtle bg-bg-primary p-3 shadow-xs">
								<span className="text-sm font-mono text-text-secondary">
									~/Documents/Projects/
								</span>
								<span className="rounded-md bg-accent-amber-bg/50 px-2 py-0.5 text-[0.6875rem] font-medium text-accent-amber border border-accent-amber/20">
									SCANNING
								</span>
							</div>
							<button
								type="button"
								className="mt-4 self-start rounded-lg border border-border-strong bg-bg-secondary px-4 py-2 text-sm font-medium text-text-primary shadow-xs transition duration-200 ease-out active:duration-75 active:scale-[0.98] hover:bg-bg-tertiary"
							>
								Add Directory...
							</button>
						</div>
					</SettingsSection>

					<SettingsSection
						icon={Key}
						title="AI Providers"
						description="Configure generative models and private API keys."
					>
						<div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
							<div className="flex flex-col gap-1 rounded-2xl border border-border-subtle bg-bg-primary p-2">
								<ToggleRow label="OpenAI (Codex)" checked={true} />
								<InputRow
									label="API Key"
									value="sk-proj-**********************"
									masked={true}
								/>
							</div>
							<div className="flex flex-col gap-1 rounded-2xl border border-border-subtle bg-bg-primary p-2">
								<ToggleRow label="Anthropic (Claude)" checked={true} />
								<InputRow
									label="API Key"
									value="sk-ant-api03-*****************"
									masked={true}
								/>
							</div>
							<div className="flex flex-col gap-1 rounded-2xl border border-border-subtle bg-bg-primary p-2 md:col-span-2">
								<ToggleRow
									label="Google (Gemini)"
									checked={false}
									description="Gemini 1.5 Pro support is currently in beta."
								/>
							</div>
						</div>
					</SettingsSection>

					<SettingsSection
						icon={Monitor}
						title="General"
						description="Global application preferences and lifecycle management."
					>
						<div className="flex flex-col gap-1 rounded-2xl border border-border-subtle bg-bg-primary p-2">
							<ToggleRow
								label="Launch at login"
								checked={true}
								description="Start Trace silently in the menu bar."
							/>
							<ToggleRow
								label="Check for updates automatically"
								checked={true}
							/>
							<div className="mt-2 p-3 border-t border-border-subtle/50">
								<button
									type="button"
									className="rounded-lg border border-border-light bg-bg-primary px-4 py-2 text-sm font-medium text-text-secondary transition duration-200 ease-out active:duration-75 active:scale-[0.98] hover:bg-bg-secondary hover:text-text-primary"
								>
									Export Debug Logs
								</button>
							</div>
						</div>
					</SettingsSection>

					<SettingsSection
						icon={Cpu}
						title="Agents"
						description="Manage access and awareness of local agent frameworks."
					>
						<div className="flex flex-col gap-1 rounded-2xl border border-border-subtle bg-bg-primary p-2">
							<ToggleRow
								label="Claude Code integrations"
								description="Allow Trace to index and learn from Claude Code sessions."
								checked={true}
							/>
							<ToggleRow
								label="Codex local automation"
								description="Enable deep context-sharing with the Codex workstation."
								checked={true}
							/>
						</div>
					</SettingsSection>
				</div>
			</main>
		</div>
	);
}
