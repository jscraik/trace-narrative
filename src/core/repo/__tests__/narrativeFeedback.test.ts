import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetDb = vi.hoisted(() => vi.fn());

vi.mock("../db", () => ({
	getDb: mockGetDb,
}));

function createMockDb(inserted = true) {
	return {
		execute: vi.fn(async (sql: string, _bindValues?: unknown[]) => {
			if (sql.includes("INSERT OR IGNORE INTO narrative_feedback_events")) {
				return { rowsAffected: inserted ? 1 : 0 };
			}
			return { rowsAffected: 0 };
		}),
		select: vi.fn(async (sql: string) => {
			if (
				sql.includes("SUM(CASE WHEN feedback_type = 'branch_missing_decision'")
			) {
				return [
					{ missing_count: 0, total_count: 1, key_count: 1, wrong_count: 0 },
				];
			}
			if (sql.includes("GROUP BY target_id")) {
				return [{ target_id: "highlight:h1", key_weight: 1, wrong_weight: 0 }];
			}
			if (sql.includes("FROM narrative_calibration_profiles")) {
				return [];
			}
			return [];
		}),
	};
}

describe("narrativeFeedback", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
	});

	it("creates stable idempotency keys for the same minute bucket", async () => {
		const mod = await import("../narrativeFeedback");
		const key1 = mod.createFeedbackIdempotencyKey({
			repoId: 1,
			branchName: "feature/narrative-loop",
			atISO: "2026-02-24T11:22:33.000Z",
			action: {
				actorRole: "developer",
				feedbackType: "highlight_key",
				targetKind: "highlight",
				targetId: "highlight:h1",
				detailLevel: "summary",
			},
		});
		const key2 = mod.createFeedbackIdempotencyKey({
			repoId: 1,
			branchName: "feature/narrative-loop",
			atISO: "2026-02-24T11:22:58.000Z",
			action: {
				actorRole: "developer",
				feedbackType: "highlight_key",
				targetKind: "highlight",
				targetId: "highlight:h1",
				detailLevel: "summary",
			},
		});

		expect(key1).toBe(key2);
	});

	it("creates distinct idempotency keys for different detail levels", async () => {
		const mod = await import("../narrativeFeedback");
		const summaryKey = mod.createFeedbackIdempotencyKey({
			repoId: 1,
			branchName: "feature/narrative-loop",
			atISO: "2026-02-24T11:22:33.000Z",
			action: {
				actorRole: "developer",
				feedbackType: "highlight_key",
				targetKind: "highlight",
				targetId: "highlight:h1",
				detailLevel: "summary",
			},
		});
		const evidenceKey = mod.createFeedbackIdempotencyKey({
			repoId: 1,
			branchName: "feature/narrative-loop",
			atISO: "2026-02-24T11:22:33.000Z",
			action: {
				actorRole: "developer",
				feedbackType: "highlight_key",
				targetKind: "highlight",
				targetId: "highlight:h1",
				detailLevel: "evidence",
			},
		});

		expect(summaryKey).not.toBe(evidenceKey);
	});

	it("rejects highlight feedback with missing target id", async () => {
		mockGetDb.mockResolvedValue(createMockDb());
		const mod = await import("../narrativeFeedback");

		await expect(
			mod.submitNarrativeFeedback({
				repoId: 1,
				branchName: "feature/narrative-loop",
				action: {
					actorRole: "developer",
					feedbackType: "highlight_key",
					targetKind: "highlight",
					detailLevel: "summary",
				},
			}),
		).rejects.toThrow("Highlight feedback requires a targetId.");
	});

	it("rejects highlight feedback with non-highlight target kind", async () => {
		mockGetDb.mockResolvedValue(createMockDb());
		const mod = await import("../narrativeFeedback");

		await expect(
			mod.submitNarrativeFeedback({
				repoId: 1,
				branchName: "feature/narrative-loop",
				action: {
					actorRole: "developer",
					feedbackType: "highlight_key",
					targetKind: "branch",
					targetId: "branch:main",
					detailLevel: "summary",
				},
			}),
		).rejects.toThrow('Highlight feedback must target kind "highlight".');
	});

	it("rejects feedback with invalid detail level", async () => {
		mockGetDb.mockResolvedValue(createMockDb());
		const mod = await import("../narrativeFeedback");

		await expect(
			mod.submitNarrativeFeedback({
				repoId: 1,
				branchName: "feature/narrative-loop",
				action: {
					actorRole: "developer",
					feedbackType: "branch_missing_decision",
					targetKind: "branch",
					detailLevel: "invalid" as never,
				},
			}),
		).rejects.toThrow("Narrative feedback detail level is invalid.");
	});

	it("rejects feedback without a branch name", async () => {
		mockGetDb.mockResolvedValue(createMockDb());
		const mod = await import("../narrativeFeedback");

		await expect(
			mod.submitNarrativeFeedback({
				repoId: 1,
				branchName: "",
				action: {
					actorRole: "developer",
					feedbackType: "branch_missing_decision",
					targetKind: "branch",
					detailLevel: "summary",
				},
			}),
		).rejects.toThrow("Narrative feedback requires a branchName.");
	});

	it("submits feedback and returns a recomputed calibration profile", async () => {
		const db = createMockDb(true);
		mockGetDb.mockResolvedValue(db);
		const mod = await import("../narrativeFeedback");

		const result = await mod.submitNarrativeFeedback({
			repoId: 1,
			branchName: "feature/narrative-loop",
			atISO: "2026-02-24T12:00:00.000Z",
			action: {
				actorRole: "reviewer",
				feedbackType: "highlight_key",
				targetKind: "highlight",
				targetId: "highlight:h1",
				detailLevel: "summary",
			},
		});

		expect(result.inserted).toBe(true);
		expect(result.verifiedActorRole).toBe("reviewer");
		expect(result.profile.repoId).toBe(1);
		expect(result.profile.sampleCount).toBe(1);
		expect(result.profile.highlightAdjustments["highlight:h1"]).toBeGreaterThan(
			0,
		);
		const feedbackInsertCall = db.execute.mock.calls.find(
			([sql]) =>
				typeof sql === "string" &&
				sql.includes("INSERT OR IGNORE INTO narrative_feedback_events"),
		);
		expect(feedbackInsertCall).toBeDefined();
		expect(feedbackInsertCall?.[1]?.[2]).toBe("reviewer");
		expect(db.execute).toHaveBeenCalled();
	});

	it("appends immutable audit events for feedback submission and calibration recompute", async () => {
		const db = createMockDb(true);
		mockGetDb.mockResolvedValue(db);
		const mod = await import("../narrativeFeedback");

		await mod.submitNarrativeFeedback({
			repoId: 1,
			branchName: "feature/narrative-loop",
			atISO: "2026-02-24T12:00:00.000Z",
			action: {
				actorRole: "developer",
				feedbackType: "highlight_key",
				targetKind: "highlight",
				targetId: "highlight:h1",
				detailLevel: "summary",
			},
		});

		const auditInserts = db.execute.mock.calls.filter(
			([sql]) =>
				typeof sql === "string" &&
				sql.includes("INSERT INTO narrative_calibration_audit_events"),
		);
		expect(auditInserts.length).toBeGreaterThanOrEqual(2);
		const eventTypes = auditInserts.map((call) => call[1]?.[1]);
		expect(eventTypes).toContain("calibration_recomputed");
		expect(eventTypes).toContain("feedback_submitted");
	});

	it("treats duplicate writes as idempotent and does not inflate insert status", async () => {
		const db = createMockDb(false);
		mockGetDb.mockResolvedValue(db);
		const mod = await import("../narrativeFeedback");

		const result = await mod.submitNarrativeFeedback({
			repoId: 1,
			branchName: "feature/narrative-loop",
			atISO: "2026-02-24T12:00:00.000Z",
			action: {
				actorRole: "developer",
				feedbackType: "highlight_key",
				targetKind: "highlight",
				targetId: "highlight:h1",
				detailLevel: "summary",
			},
			idempotencyKey:
				"narrative-feedback:1:feature/narrative-loop:developer:highlight_key:highlight:highlight:h1:summary:2026-02-24T12:00",
		});

		expect(result.inserted).toBe(false);
		expect(result.profile.sampleCount).toBe(1);
	});

	it("reuses stored calibration profile for duplicate writes without recomputing", async () => {
		const db = {
			execute: vi.fn(async (sql: string, _bindValues?: unknown[]) => {
				if (sql.includes("INSERT OR IGNORE INTO narrative_feedback_events")) {
					return { rowsAffected: 0 };
				}
				return { rowsAffected: 1 };
			}),
			select: vi.fn(async (sql: string) => {
				if (sql.includes("FROM narrative_calibration_profiles")) {
					return [
						{
							repo_id: 1,
							ranking_bias: 0.02,
							confidence_offset: 0.01,
							confidence_scale: 1.01,
							sample_count: 7,
							window_start: "2026-01-30T00:00:00.000Z",
							window_end: "2026-02-24T00:00:00.000Z",
							actor_weight_policy_version: "v1",
							branch_missing_decision_count: 1,
							updated_at: "2026-02-24T00:00:00.000Z",
						},
					];
				}
				if (sql.includes("GROUP BY target_id")) {
					return [
						{ target_id: "highlight:h1", key_weight: 2.2, wrong_weight: 0 },
					];
				}
				return [];
			}),
		};
		mockGetDb.mockResolvedValue(db);
		const mod = await import("../narrativeFeedback");

		const result = await mod.submitNarrativeFeedback({
			repoId: 1,
			branchName: "feature/narrative-loop",
			atISO: "2026-02-24T12:00:00.000Z",
			action: {
				actorRole: "developer",
				feedbackType: "highlight_key",
				targetKind: "highlight",
				targetId: "highlight:h1",
				detailLevel: "summary",
			},
			idempotencyKey:
				"narrative-feedback:1:feature/narrative-loop:developer:highlight_key:highlight:highlight:h1:summary:2026-02-24T12:00",
		});

		expect(result.inserted).toBe(false);
		expect(result.profile.sampleCount).toBe(7);
		expect(result.profile.windowStartISO).toBe("2026-01-30T00:00:00.000Z");
		expect(db.execute).not.toHaveBeenCalledWith(
			expect.stringContaining("INSERT INTO narrative_calibration_profiles"),
			expect.anything(),
		);
	});

	it("uses a rolling 30-day window for calibration aggregates", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-02-24T12:00:00.000Z"));

		const db = createMockDb(true);
		mockGetDb.mockResolvedValue(db);
		const mod = await import("../narrativeFeedback");

		await mod.submitNarrativeFeedback({
			repoId: 1,
			branchName: "feature/narrative-loop",
			atISO: "2026-02-24T12:00:00.000Z",
			action: {
				actorRole: "developer",
				feedbackType: "highlight_key",
				targetKind: "highlight",
				targetId: "highlight:h1",
				detailLevel: "summary",
			},
		});

		const expectedWindowStart = "2026-01-25T12:00:00.000Z";
		expect(db.select).toHaveBeenCalledWith(
			expect.stringContaining("COUNT(*) AS total_count"),
			[1, expectedWindowStart],
		);
		expect(db.select).toHaveBeenCalledWith(
			expect.stringContaining("GROUP BY target_id"),
			[1, expectedWindowStart],
		);
		vi.useRealTimers();
	});

	it("uses stored profile window when loading calibration profile", async () => {
		const db = {
			execute: vi.fn(async () => ({ rowsAffected: 0 })),
			select: vi.fn(async (sql: string) => {
				if (sql.includes("FROM narrative_calibration_profiles")) {
					return [
						{
							repo_id: 1,
							ranking_bias: 0,
							confidence_offset: 0,
							confidence_scale: 1,
							sample_count: 3,
							window_start: "2026-01-30T00:00:00.000Z",
							window_end: "2026-02-24T00:00:00.000Z",
							actor_weight_policy_version: "v1",
							branch_missing_decision_count: 0,
							updated_at: "2026-02-24T00:00:00.000Z",
						},
					];
				}
				if (sql.includes("GROUP BY target_id")) {
					return [
						{ target_id: "highlight:h1", key_weight: 1, wrong_weight: 0 },
					];
				}
				return [];
			}),
		};
		mockGetDb.mockResolvedValue(db);
		const mod = await import("../narrativeFeedback");

		const profile = await mod.getNarrativeCalibrationProfile(1);

		expect(profile?.windowStartISO).toBe("2026-01-30T00:00:00.000Z");
		expect(db.select).toHaveBeenCalledWith(
			expect.stringContaining("GROUP BY target_id"),
			[1, "2026-01-30T00:00:00.000Z"],
		);
	});

	it("retries transient persistence failures before succeeding", async () => {
		vi.useFakeTimers();

		let insertAttempts = 0;
		const baseDb = createMockDb(true);
		const db = {
			...baseDb,
			execute: vi.fn(async (sql: string, _bindValues?: unknown[]) => {
				if (sql.includes("INSERT OR IGNORE INTO narrative_feedback_events")) {
					insertAttempts += 1;
					if (insertAttempts < 3) {
						throw new Error("database is locked");
					}
					return { rowsAffected: 1 };
				}
				return { rowsAffected: 0 };
			}),
		};
		mockGetDb.mockResolvedValue(db);
		const mod = await import("../narrativeFeedback");

		const submitPromise = mod.submitNarrativeFeedback({
			repoId: 1,
			branchName: "feature/narrative-loop",
			atISO: "2026-02-24T12:00:00.000Z",
			action: {
				actorRole: "developer",
				feedbackType: "highlight_key",
				targetKind: "highlight",
				targetId: "highlight:h1",
				detailLevel: "summary",
			},
		});

		await vi.runAllTimersAsync();
		const result = await submitPromise;
		vi.useRealTimers();

		expect(result.inserted).toBe(true);
		expect(insertAttempts).toBe(3);
	});

	it("retries transient persistence failures when writing calibration profiles", async () => {
		vi.useFakeTimers();

		let profileWriteAttempts = 0;
		const db = {
			execute: vi.fn(async (sql: string, _bindValues?: unknown[]) => {
				if (sql.includes("INSERT OR IGNORE INTO narrative_feedback_events")) {
					return { rowsAffected: 1 };
				}
				if (sql.includes("INSERT INTO narrative_calibration_profiles")) {
					profileWriteAttempts += 1;
					if (profileWriteAttempts < 3) {
						throw new Error("database is locked");
					}
					return { rowsAffected: 1 };
				}
				return { rowsAffected: 0 };
			}),
			select: vi.fn(async (sql: string) => {
				if (
					sql.includes(
						"SUM(CASE WHEN feedback_type = 'branch_missing_decision'",
					)
				) {
					return [
						{ missing_count: 0, total_count: 1, key_count: 1, wrong_count: 0 },
					];
				}
				if (sql.includes("GROUP BY target_id")) {
					return [
						{ target_id: "highlight:h1", key_weight: 1, wrong_weight: 0 },
					];
				}
				if (sql.includes("FROM narrative_calibration_profiles")) {
					return [];
				}
				return [];
			}),
		};

		mockGetDb.mockResolvedValue(db);
		const mod = await import("../narrativeFeedback");

		const submitPromise = mod.submitNarrativeFeedback({
			repoId: 1,
			branchName: "feature/narrative-loop",
			atISO: "2026-02-24T12:00:00.000Z",
			action: {
				actorRole: "developer",
				feedbackType: "highlight_key",
				targetKind: "highlight",
				targetId: "highlight:h1",
				detailLevel: "summary",
			},
		});

		await vi.runAllTimersAsync();
		const result = await submitPromise;
		vi.useRealTimers();

		expect(result.inserted).toBe(true);
		expect(profileWriteAttempts).toBe(3);
	});
});
