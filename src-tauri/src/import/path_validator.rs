//! Path validation for security
//!
//! Ensures session files are read from expected locations only,
//! preventing path traversal attacks.

use std::path::{Path, PathBuf};

/// Validates session file paths for security
pub struct PathValidator;

/// Errors that can occur during path validation
#[derive(Debug, Clone, PartialEq)]
pub enum PathValidationError {
    /// Path does not exist
    NotFound,
    /// Path is outside allowed directories
    OutsideAllowedDirectory,
    /// Path contains traversal sequences (../)
    PathTraversalDetected,
    /// Path is not a file
    NotAFile,
    /// Could not resolve canonical path
    CanonicalizationFailed,
}

impl std::fmt::Display for PathValidationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PathValidationError::NotFound => write!(f, "File not found"),
            PathValidationError::OutsideAllowedDirectory => {
                write!(f, "File is outside allowed directories")
            }
            PathValidationError::PathTraversalDetected => {
                write!(f, "Path traversal detected")
            }
            PathValidationError::NotAFile => write!(f, "Path is not a file"),
            PathValidationError::CanonicalizationFailed => {
                write!(f, "Could not resolve canonical path")
            }
        }
    }
}

impl std::error::Error for PathValidationError {}

impl PathValidator {
    fn push_unique(dirs: &mut Vec<PathBuf>, path: PathBuf) {
        if !dirs.iter().any(|existing| existing == &path) {
            dirs.push(path);
        }
    }

    fn push_unique_with_canonical(dirs: &mut Vec<PathBuf>, path: PathBuf) {
        if !dirs.iter().any(|existing| existing == &path) {
            dirs.push(path.clone());
        }
        if let Ok(canonical) = path.canonicalize() {
            if !dirs.iter().any(|existing| existing == &canonical) {
                dirs.push(canonical);
            }
        }
    }

    /// Validate that a path is safe to read
    ///
    /// Checks:
    /// 1. No path traversal sequences (../) - SECURITY FIRST
    /// 2. Path exists and is a file
    /// 3. Path can be canonicalized
    /// 4. Path is within allowed directories
    pub fn validate(path: &Path) -> Result<(), PathValidationError> {
        // SECURITY: Check for path traversal FIRST (before any file operations)
        if Self::has_traversal(path) {
            return Err(PathValidationError::PathTraversalDetected);
        }

        // Check path exists
        if !path.exists() {
            return Err(PathValidationError::NotFound);
        }

        // Check it's a file (not directory)
        if !path.is_file() {
            return Err(PathValidationError::NotAFile);
        }

        // Get canonical path (resolves symlinks, ., ..)
        let canonical = path
            .canonicalize()
            .map_err(|_| PathValidationError::CanonicalizationFailed)?;

        // Check against allowed directories
        let allowed = Self::allowed_directories();
        let is_allowed = allowed.iter().any(|prefix| canonical.starts_with(prefix));

        if !is_allowed {
            return Err(PathValidationError::OutsideAllowedDirectory);
        }

        Ok(())
    }

    /// Quick check if path contains traversal sequences
    fn has_traversal(path: &Path) -> bool {
        path.components()
            .any(|c| matches!(c, std::path::Component::ParentDir))
    }

    /// Get list of allowed directories for session files
    ///
    /// These are the standard locations where AI tools store their data.
    /// Paths outside these directories are rejected for security.
    fn allowed_directories() -> Vec<PathBuf> {
        let mut dirs = Vec::new();

        if let Some(home) = dirs::home_dir() {
            // Claude Code
            Self::push_unique(&mut dirs, home.join(".claude"));

            // Cursor
            Self::push_unique(&mut dirs, home.join(".cursor"));

            // Continue
            Self::push_unique(&mut dirs, home.join(".continue"));

            // Codex
            Self::push_unique(&mut dirs, home.join(".codex"));

            // Generic
            Self::push_unique(&mut dirs, home.join(".config"));
        }

        // Also allow temp directories for testing.
        // On macOS these can resolve through symlinks (for example `/var` -> `/private/var`),
        // so we include both configured and canonicalized variants.
        if let Some(tmpdir) = std::env::var_os("TMPDIR") {
            Self::push_unique_with_canonical(&mut dirs, PathBuf::from(tmpdir));
        }
        Self::push_unique_with_canonical(&mut dirs, std::env::temp_dir());
        Self::push_unique_with_canonical(&mut dirs, PathBuf::from("/tmp"));

        dirs
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[test]
    fn test_rejects_traversal() {
        let path = Path::new("/home/user/.claude/../../../etc/passwd");
        let result = PathValidator::validate(path);

        assert_eq!(result, Err(PathValidationError::PathTraversalDetected));
    }

    #[test]
    fn test_rejects_nonexistent() {
        let path = Path::new("/home/user/.claude/nonexistent-file.jsonl");
        let result = PathValidator::validate(path);

        assert_eq!(result, Err(PathValidationError::NotFound));
    }

    #[test]
    fn test_accepts_valid_claude_path() {
        // Create a temp file that looks like a Claude session
        let mut temp_file = NamedTempFile::new().unwrap();
        writeln!(temp_file, "test").unwrap();

        // Temp files are in /tmp which is allowed
        let result = PathValidator::validate(temp_file.path());

        assert!(result.is_ok());
    }

    #[test]
    fn test_has_traversal_detection() {
        assert!(PathValidator::has_traversal(Path::new("../file.txt")));
        assert!(PathValidator::has_traversal(Path::new("foo/../../bar")));
        assert!(!PathValidator::has_traversal(Path::new("foo/bar/baz.txt")));
        assert!(!PathValidator::has_traversal(Path::new("./file.txt")));
    }
}
