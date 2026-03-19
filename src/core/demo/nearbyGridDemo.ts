import type { BranchViewModel, TestRun } from "../types";

export const testRuns: Record<string, TestRun> = {
	tr1: {
		id: "tr1",
		sessionId: "s1",
		atISO: "2026-01-17T15:30:00Z",
		durationSec: 1.24,
		passed: 12,
		failed: 4,
		skipped: 2,
		tests: [
			{
				id: "t1",
				name: "validate() should throw on missing required field",
				status: "failed",
				durationMs: 42,
				errorMessage: "Expected ValidationError to be thrown but got undefined",
				filePath: "src/parser/validate.ts",
			},
			{
				id: "t2",
				name: "validate() should return errors array in non-strict mode",
				status: "failed",
				durationMs: 38,
				errorMessage: "Expected errors.length to be 2, received 0",
				filePath: "src/parser/validate.ts",
			},
			{
				id: "t3",
				name: "Schema type checking should reject invalid nested objects",
				status: "failed",
				durationMs: 56,
				errorMessage: 'Object type mismatch at path "user.profile"',
				filePath: "src/parser/schema.ts",
			},
			{
				id: "t4",
				name: "validateArray() should handle empty arrays",
				status: "failed",
				durationMs: 23,
				errorMessage: 'Cannot read property "length" of undefined',
				filePath: "src/parser/validate.ts",
			},
			{
				id: "t5",
				name: "formatDistance() should convert meters to feet",
				status: "passed",
				durationMs: 12,
				filePath: "src/utils/distance.ts",
			},
			{
				id: "t6",
				name: "formatDistance() should show miles when >1000ft",
				status: "passed",
				durationMs: 15,
				filePath: "src/utils/distance.ts",
			},
			{
				id: "t7",
				name: "OnlineIndicator should show pulsing animation when active",
				status: "passed",
				durationMs: 89,
				filePath: "src/components/OnlineIndicator.vue",
			},
			{
				id: "t8",
				name: "ProfileCard should render user photo",
				status: "passed",
				durationMs: 34,
				filePath: "src/components/ProfileCard.vue",
			},
			{
				id: "t9",
				name: "useGeolocation should request permission",
				status: "passed",
				durationMs: 156,
				filePath: "src/composables/useGeolocation.ts",
			},
			{
				id: "t10",
				name: "useGeolocation should handle permission denied",
				status: "passed",
				durationMs: 45,
				filePath: "src/composables/useGeolocation.ts",
			},
			{
				id: "t11",
				name: "NearbyGrid should virtualize long lists",
				status: "skipped",
				durationMs: 0,
				filePath: "src/components/NearbyGrid.vue",
			},
			{
				id: "t12",
				name: "NearbyGrid should sort by distance",
				status: "skipped",
				durationMs: 0,
				filePath: "src/components/NearbyGrid.vue",
			},
		],
	},
	tr2: {
		id: "tr2",
		sessionId: "s2",
		atISO: "2026-01-18T10:15:00Z",
		durationSec: 0.89,
		passed: 16,
		failed: 0,
		skipped: 2,
		tests: [
			{
				id: "t21",
				name: "validate() should throw on missing required field",
				status: "passed",
				durationMs: 18,
				filePath: "src/parser/validate.ts",
			},
			{
				id: "t22",
				name: "validate() should return errors array in non-strict mode",
				status: "passed",
				durationMs: 22,
				filePath: "src/parser/validate.ts",
			},
			{
				id: "t23",
				name: "Schema type checking should reject invalid nested objects",
				status: "passed",
				durationMs: 31,
				filePath: "src/parser/schema.ts",
			},
		],
	},
};

export const NearbyGridDemo: BranchViewModel = {
	source: "demo",
	title: "feature/nearby-grid",
	status: "open",
	description:
		"Redesign the nearby users grid with distance sorting, online indicators, and swipeable profile cards.",
	stats: {
		added: 847,
		removed: 203,
		files: 12,
		commits: 6,
		prompts: 14,
		responses: 14,
	},
	intent: [
		{
			id: "i1",
			text: "Replaced distance calculation with Haversine formula for accuracy at short ranges",
			tag: "distance.ts",
		},
		{
			id: "i2",
			text: "Separated online status into its own component for reuse in chat list",
			tag: "OnlineIndicator.vue",
		},
		{
			id: "i3",
			text: "User requested feet/miles toggle based on locale, not just distance threshold",
			tag: "session #2",
		},
		{
			id: "i4",
			text: "Extracted geolocation to composable to handle permission flow consistently",
			tag: "useGeolocation.ts",
		},
		{
			id: "i5",
			text: "Added grid virtualization after profiling showed lag with 50+ nearby users",
			tag: "session #3",
		},
	],
	sessionExcerpts: [
		{
			id: "s1",
			tool: "claude-code",
			durationMin: 28,
			messages: [
				{
					id: "m1",
					role: "user",
					text: "Create a ProfileCard component showing the user's main photo, online status, distance, and age. Add a gradient overlay at the bottom. On tap, expand to show more photos.",
				},
				{
					id: "m2",
					role: "assistant",
					text: "I'll create ProfileCard.vue with the photo display, online indicator dot, and gradient overlay. I'll add a touch handler to expand and reveal the photo carousel.",
					files: [
						"ProfileCard.vue",
						"OnlineIndicator.vue",
						"useGeolocation.ts",
					],
				},
				{
					id: "m2a",
					role: "thinking",
					text: "Prioritize the card layout first, then wire the expansion state once the base component renders.",
				},
				{
					id: "m2b",
					role: "plan",
					text: "Plan: 1) build ProfileCard shell 2) add online indicator 3) attach expansion behavior.",
				},
				{
					id: "m2c",
					role: "tool_call",
					text: "writeFile ProfileCard.vue",
					toolName: "writeFile",
					files: ["ProfileCard.vue"],
				},
				{
					id: "m3",
					role: "user",
					text: "The distance shows in meters but I need feet when <1000ft, miles otherwise. Also add 'Online now' text for users active in last 5 min.",
				},
				{
					id: "m4",
					role: "assistant",
					text: "I'll update the distance formatter in utils/distance.ts and add the online recency logic to the indicator component.",
					files: ["distance.ts", "OnlineIndicator.vue"],
				},
				{
					id: "m5",
					role: "user",
					text: "Perfect. One more thing - can you add a subtle pulsing animation to the online indicator when the user is currently active?",
				},
			],
		},
	],
	filesChanged: [
		{ path: "src/components/NearbyGrid.vue", additions: 312, deletions: 45 },
		{ path: "src/components/ProfileCard.vue", additions: 186, deletions: 0 },
		{ path: "src/composables/useGeolocation.ts", additions: 94, deletions: 12 },
		{ path: "src/services/LocationService.ts", additions: 78, deletions: 34 },
		{ path: "src/stores/nearbyUsers.ts", additions: 67, deletions: 23 },
		{ path: "src/types/User.ts", additions: 45, deletions: 8 },
		{ path: "src/parser/validate.ts", additions: 124, deletions: 32 },
		{ path: "src/parser/schema.ts", additions: 89, deletions: 15 },
	],
	diffsByFile: {
		"src/components/ProfileCard.vue": `diff --git a/src/components/ProfileCard.vue b/src/components/ProfileCard.vue
new file mode 100644
index 0000000..c0ffee1
--- /dev/null
+++ b/src/components/ProfileCard.vue
@@ -0,0 +1,48 @@
+<template>
+  <div class="profile-card" @click="toggleExpand">
+    <img :src="user.photos[0]" class="avatar" />
+    <OnlineIndicator :lastSeen="user.lastSeen" />
+    <div class="overlay">
+      <span class="dist">{{ fmtDist(user.distance) }}</span>
+      <span class="age">{{ user.age }}</span>
+    </div>
+  </div>
+</template>
+
+<script setup lang="ts">
+import OnlineIndicator from './OnlineIndicator.vue'
+import { fmtDist } from '../utils/distance'
+const props = defineProps<{ user: any }>()
+function toggleExpand() {
+  // TODO: expand to show carousel
+}
+</script>
`,
	},
	timeline: [
		{
			id: "t0",
			type: "milestone",
			label: "Branch created",
			status: "ok",
			atISO: "2026-01-17T10:00:00Z",
		},
		{
			id: "t1",
			type: "milestone",
			label: "Created the parsing foundation",
			status: "ok",
			atISO: "2026-01-17T15:00:00Z",
			testRunId: "tr1",
			badges: [
				{ type: "test", label: "4 failed", status: "failed" },
				{ type: "file", label: "validate.ts" },
			],
		},
		{
			id: "t2",
			type: "milestone",
			label: "Set up memory-efficient streaming",
			status: "ok",
			atISO: "2026-01-18T09:00:00Z",
			testRunId: "tr2",
			badges: [
				{ type: "test", label: "12 passed", status: "passed" },
				{ type: "file", label: "schema.ts" },
			],
		},
		{
			id: "t3",
			type: "milestone",
			label: "Built lazy-loading for commit history",
			status: "ok",
			atISO: "2026-01-18T18:00:00Z",
			badges: [
				{ type: "file", label: "NearbyGrid.vue" },
				{ type: "file", label: "ProfileCard.vue" },
			],
		},
		{
			id: "t4",
			type: "milestone",
			label: "Added crash recovery & rollback",
			status: "ok",
			atISO: "2026-01-19T10:00:00Z",
		},
		{
			id: "t5",
			type: "milestone",
			label: "Improved popup accessibility",
			status: "ok",
			atISO: "2026-01-19T17:00:00Z",
		},
		{
			id: "t6",
			type: "milestone",
			label: "Pivoted to browser-based parsing",
			status: "warn",
			atISO: "2026-01-20T09:00:00Z",
		},
		{
			id: "t7",
			type: "milestone",
			label: "Parser complete",
			status: "error",
			atISO: "2026-01-20T16:00:00Z",
		},
	],
};
