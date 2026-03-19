import { Command } from "@tauri-apps/plugin-shell";

export type ShellOutput = {
	code: number | null;
	stdout: string;
	stderr: string;
};

export class ShellError extends Error {
	public readonly output?: ShellOutput;
	constructor(message: string, output?: ShellOutput) {
		super(message);
		this.name = "ShellError";
		this.output = output;
	}
}

/**
 * Executes a command configured in Tauri capabilities (src-tauri/capabilities/default.json).
 *
 * NOTE:
 * - For MVP we only allow executing `git` with an argument list.
 * - `program` must match the `name` field in the shell permission scope.
 */
export async function execProgram(
	program: string,
	args: string[],
	options?: { cwd?: string },
): Promise<ShellOutput> {
	const cmd = Command.create(program, args, {
		cwd: options?.cwd,
		encoding: "utf-8",
	});

	const out = await cmd.execute();
	return {
		code: out.code ?? null,
		stdout: String(out.stdout ?? ""),
		stderr: String(out.stderr ?? ""),
	};
}
