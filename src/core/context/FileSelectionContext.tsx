import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useState,
} from "react";

interface FileSelectionContextValue {
	selectedFile: string | null;
	selectFile: (path: string | null) => void;
}

const FileSelectionContext = createContext<FileSelectionContextValue | null>(
	null,
);

export function FileSelectionProvider({ children }: { children: ReactNode }) {
	const [selectedFile, setSelectedFile] = useState<string | null>(null);

	const selectFile = useCallback((path: string | null) => {
		setSelectedFile(path);
	}, []);

	return (
		<FileSelectionContext.Provider value={{ selectedFile, selectFile }}>
			{children}
		</FileSelectionContext.Provider>
	);
}

export function useFileSelection() {
	const ctx = useContext(FileSelectionContext);
	if (!ctx) {
		throw new Error(
			"useFileSelection must be used within FileSelectionProvider",
		);
	}
	return ctx;
}
