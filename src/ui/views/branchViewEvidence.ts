import type { NarrativeEvidenceLink } from "../../core/types";

export function shouldRouteEvidenceToRawDiff(
	link: NarrativeEvidenceLink,
): boolean {
	return link.kind === "diff";
}
