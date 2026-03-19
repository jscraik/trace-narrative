import { FileSelectionProvider } from "../../core/context/FileSelectionContext";
import { BranchViewLayout } from "./BranchViewLayout";
import { useBranchViewController } from "./branch-view/useBranchViewController";
import type { BranchViewProps } from "./branchView.types";

export type { BranchViewProps } from "./branchView.types";

function BranchViewInner(props: BranchViewProps) {
	const layoutProps = useBranchViewController(props);
	return <BranchViewLayout {...layoutProps} />;
}

export function BranchView(props: BranchViewProps) {
	return (
		<FileSelectionProvider>
			<BranchViewInner {...props} />
		</FileSelectionProvider>
	);
}
