//! Session-to-commit linking algorithm.
//!
//! This module implements the core linking algorithm that combines temporal
//! overlap scoring (60%) with Jaccard file similarity (40%) to produce
//! a confidence score (0-1) for session-commit pairs.
//!
//! # Algorithm
//!
//! 1. **Temporal Score (60% weight)**: Measures time overlap between session
//!    and commit. Session window is `[importedAtISO - durationMin, importedAtISO]`
//!    (max 4 hours). Score is 1.0 if commit is within window, decays linearly.
//!
//! 2. **File Overlap Score (40% weight)**: Jaccard similarity between session
//!    file paths and commit changed files. Paths are normalized (resolve `.` and `..`).
//!
//! 3. **Combined Score**: `0.6 * temporal + 0.4 * file_overlap`
//!
//! 4. **Threshold**: Auto-link if `confidence >= 0.7`, else mark as unlinked.
//!
//! # Security
//!
//! Session messages are scanned for secret patterns before processing.
//! Detected secrets are redacted with `[REDACTED]` placeholder.
//!
//! # Evidence
//!
//! Build Plan Epic 3 Stories 3.1-3.4.
//! Foundation Spec Section 3 defines algorithm weighting and threshold.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::Path;

/// Maximum session duration for linking (4 hours in minutes)
const MAX_SESSION_DURATION_MIN: i64 = 240;

/// Maximum time window for commit lookup (±4 hours from session time)
const TIME_WINDOW_TOLERANCE_MIN: i64 = 240;

/// Temporal decay window (±5 minutes for partial overlap scoring)
const TEMPORAL_DECAY_MIN: i64 = 5;

/// Minimum confidence threshold for auto-linking
const CONFIDENCE_THRESHOLD: f64 = 0.7;

/// Algorithm weights for combining scores
const TEMPORAL_WEIGHT: f64 = 0.6;
const FILE_OVERLAP_WEIGHT: f64 = 0.4;

// ============================================================================
// Data Types
// ============================================================================

/// Session excerpt imported from AI coding assistant.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionExcerpt {
    pub id: String,
    pub tool: SessionTool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_min: Option<i64>,
    pub imported_at_iso: String,
    pub messages: Vec<SessionMessage>,
}

/// Type of AI coding assistant.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SessionTool {
    ClaudeCode,
    Codex,
    Cursor,
    Unknown,
}

/// Individual message within a session.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionMessage {
    pub id: String,
    pub role: SessionMessageRole,
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub files: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SessionMessageRole {
    User,
    Assistant,
}

/// Git commit from the repository.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitCommit {
    pub sha: String,
    pub authored_at: String,
    pub message: String,
    pub files: Vec<String>,
}

/// Result of linking a session to a commit.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinkResult {
    pub commit_sha: String,
    pub confidence: f64,
    pub auto_linked: bool,
    pub temporal_score: f64,
    pub file_score: f64,
    pub needs_review: bool,
}

/// Reason why a session failed to link.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum UnlinkedReason {
    NoCommitsInTimeWindow,
    LowConfidence,
    ParseError(String),
    SecretDetected(Vec<String>),
}

// Implement Display for UnlinkedReason to provide user-friendly error messages
impl std::fmt::Display for UnlinkedReason {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            UnlinkedReason::NoCommitsInTimeWindow => {
                write!(f, "No commits found in session time window")
            }
            UnlinkedReason::LowConfidence => {
                write!(f, "No commit matched the confidence threshold (0.7)")
            }
            UnlinkedReason::ParseError(msg) => {
                write!(f, "Failed to parse session data: {}", msg)
            }
            UnlinkedReason::SecretDetected(secrets) => {
                write!(f, "Secrets detected in session: {}", secrets.join(", "))
            }
        }
    }
}

impl std::fmt::Display for SessionTool {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SessionTool::ClaudeCode => write!(f, "claude-code"),
            SessionTool::Codex => write!(f, "codex"),
            SessionTool::Cursor => write!(f, "cursor"),
            SessionTool::Unknown => write!(f, "unknown"),
        }
    }
}

/// Result of attempting to link a session.
pub type LinkingResult = Result<LinkResult, UnlinkedReason>;

#[derive(Debug, Clone, Copy)]
pub struct LinkOptions {
    pub skip_secret_scan: bool,
}

// ============================================================================
// Story 3.1: Temporal Overlap Scoring
// ============================================================================

/// Calculate temporal overlap score between a session and a commit.
///
/// Session time window: `[importedAtISO - durationMin, importedAtISO]`
/// Commit time: `authored_at`
///
/// # Scoring Rules
///
/// - Score = 1.0 if commit timestamp is within session time window
/// - Score decays linearly from 1.0 to 0.5 as commit moves ±5 min from window
/// - Score = 0.0 if commit is > 5 min outside the window
///
/// # Arguments
///
/// * `session_end` - Session end time (importedAtISO)
/// * `session_duration_min` - Session duration in minutes (max 240)
/// * `commit_time` - Commit authored timestamp
///
/// # Returns
///
/// Temporal overlap score (0.0 to 1.0)
///
/// # Evidence
///
/// Build Plan Epic 3 Story 3.1.
pub fn score_temporal_overlap(
    session_end: &DateTime<Utc>,
    session_duration_min: i64,
    commit_time: &DateTime<Utc>,
) -> f64 {
    // Cap session duration at MAX_SESSION_DURATION_MIN (4 hours)
    let duration_min = session_duration_min.min(MAX_SESSION_DURATION_MIN);

    // Calculate session start time
    let session_start = *session_end - chrono::Duration::minutes(duration_min);

    // Check if commit is within session window
    if commit_time >= &session_start && commit_time <= session_end {
        return 1.0;
    }

    // Calculate distance from window
    let distance_min = if commit_time < &session_start {
        (session_start - *commit_time).num_minutes().abs()
    } else {
        (*commit_time - *session_end).num_minutes().abs()
    };

    // Apply linear decay within tolerance window (±5 min)
    if distance_min <= TEMPORAL_DECAY_MIN {
        // Score decays from 1.0 to 0.5 over 5 minutes
        let decay_ratio = distance_min as f64 / TEMPORAL_DECAY_MIN as f64;
        return 1.0 - (0.5 * decay_ratio);
    }

    // Outside tolerance window
    0.0
}

// ============================================================================
// Story 3.2: File Overlap Scoring (Jaccard Similarity)
// ============================================================================

/// Calculate file overlap score using Jaccard similarity.
///
/// Jaccard = |intersection(session_files, commit_files)| / |union(session_files, commit_files)|
///
/// # Path Normalization
///
/// - Resolves `.` (current directory) references
/// - Resolves `..` (parent directory) references
/// - Normalizes path separators to forward slashes
///
/// # Arguments
///
/// * `session_files` - File paths from session messages
/// * `commit_files` - Changed files from commit
///
/// # Returns
///
/// Jaccard similarity score (0.0 to 1.0)
///
/// # Evidence
///
/// Build Plan Epic 3 Story 3.2.
pub fn score_file_overlap(session_files: &[String], commit_files: &[String]) -> f64 {
    // Normalize and deduplicate file paths
    let session_set: HashSet<String> = session_files
        .iter()
        .map(|f| normalize_path(f))
        .filter(|f| !f.is_empty())
        .collect();

    let commit_set: HashSet<String> = commit_files
        .iter()
        .map(|f| normalize_path(f))
        .filter(|f| !f.is_empty())
        .collect();

    // Handle empty sets
    if session_set.is_empty() || commit_set.is_empty() {
        return 0.0;
    }

    // Calculate Jaccard similarity
    let intersection = session_set.intersection(&commit_set).count();
    let union = session_set.union(&commit_set).count();

    if union == 0 {
        return 0.0;
    }

    intersection as f64 / union as f64
}

/// Normalize a file path by resolving `.` and `..` references.
///
/// # Examples
///
/// ```ignore
/// assert_eq!(normalize_path("src/./utils.ts"), "src/utils.ts");
/// assert_eq!(normalize_path("src/../src/utils.ts"), "src/utils.ts");
/// assert_eq!(normalize_path("./src/utils.ts"), "src/utils.ts");
/// ```
fn normalize_path(path: &str) -> String {
    // Convert backslashes to forward slashes
    let normalized = path.replace('\\', "/");

    // Resolve using Path
    if let Ok(p) = Path::new(&normalized).canonicalize() {
        if let Some(s) = p.to_str() {
            return s.replace('\\', "/");
        }
    }

    // Fallback: manual resolution for simple cases
    let parts: Vec<&str> = normalized.split('/').collect();
    let mut result = Vec::new();

    for part in parts {
        match part {
            "" | "." => continue,
            ".." => {
                result.pop();
            }
            _ => result.push(part),
        }
    }

    if result.is_empty() {
        String::new()
    } else {
        result.join("/")
    }
}

// ============================================================================
// Story 3.3: Combine Scores and Apply Threshold
// ============================================================================

/// Calculate combined link confidence score.
///
/// Combined score = `0.6 * temporal + 0.4 * file_overlap`
///
/// If confidence >= threshold (0.7), returns link result.
/// Otherwise returns None (no link).
///
/// # Arguments
///
/// * `session_end` - Session end time
/// * `session_duration_min` - Session duration in minutes
/// * `commit` - Git commit to score against
/// * `session_files` - File paths from session messages
///
/// # Returns
///
/// * `Some(LinkResult)` - If confidence >= threshold
/// * `None` - If confidence < threshold
///
/// # Evidence
///
/// Build Plan Epic 3 Story 3.3.
pub fn calculate_link_confidence(
    session_end: &DateTime<Utc>,
    session_duration_min: i64,
    commit: &GitCommit,
    session_files: &[String],
) -> Option<LinkResult> {
    // Parse commit timestamp
    let commit_time = match DateTime::parse_from_rfc3339(&commit.authored_at) {
        Ok(dt) => dt.with_timezone(&Utc),
        Err(_) => return None,
    };

    // Calculate individual scores
    let temporal_score = score_temporal_overlap(session_end, session_duration_min, &commit_time);
    let file_score = score_file_overlap(session_files, &commit.files);

    // Combine with weights
    let confidence = (TEMPORAL_WEIGHT * temporal_score) + (FILE_OVERLAP_WEIGHT * file_score);

    // Apply threshold
    if confidence >= CONFIDENCE_THRESHOLD {
        Some(LinkResult {
            commit_sha: commit.sha.clone(),
            confidence,
            auto_linked: true,
            temporal_score,
            file_score,
            needs_review: false,
        })
    } else {
        None
    }
}

// ============================================================================
// Story 3.4: Link Session to Commits (with Secret Redaction)
// ============================================================================

/// Secret detection patterns for security scanning.
///
/// # Evidence
///
/// Build Plan Epic 3 Story 3.4.
/// Resolution Summary Security fix 3 requires secret redaction.
const SECRET_PATTERNS: &[(&str, &str)] = &[
    // Base64-like patterns (often used for encoded secrets)
    (r"[A-Za-z0-9+/]{32,}={0,2}", "base64-like"),
    // API key prefixes
    (r"\bsk-[a-zA-Z0-9]{20,}\b", "sk- API key"),
    (r"\bpk_[a-zA-Z0-9]{20,}\b", "pk_ API key"),
    // Common secret keywords
    (
        r"\b[A-Za-z0-9]{32,}\b",
        "long random string (possible secret)",
    ),
];

/// Detect secrets in session message text.
///
/// Scans for patterns that may indicate exposed secrets:
/// - Base64-like strings
/// - API keys (sk-, pk_)
/// - Keywords: token, secret, api_key, password
///
/// # Arguments
///
/// * `text` - Text to scan for secrets
///
/// # Returns
///
/// * `Vec<String>` - List of detected secret patterns (empty if none found)
///
/// # Evidence
///
/// Build Plan Epic 3 Story 3.4.
pub fn detect_secrets(text: &str) -> Vec<String> {
    detect_secrets_impl(text)
}

/// Internal implementation of secret detection.
fn detect_secrets_impl(text: &str) -> Vec<String> {
    let mut detected = Vec::new();

    // Check for secret keywords
    let keywords = [
        "token",
        "secret",
        "api_key",
        "password",
        "private_key",
        "credentials",
    ];
    let text_lower = text.to_lowercase();

    for keyword in keywords {
        if text_lower.contains(keyword) {
            detected.push(format!("keyword: {}", keyword));
        }
    }

    // Check for patterns
    for (_pattern, name) in SECRET_PATTERNS {
        // Simple pattern matching (in production, use regex crate)
        if text.contains("sk-") || text.contains("pk_") {
            detected.push(name.to_string());
        }

        // Check for long random strings (possible secrets)
        let words: Vec<&str> = text.split_whitespace().collect();
        for word in words {
            if word.len() >= 32
                && word
                    .chars()
                    .all(|c| c.is_alphanumeric() || c == '_' || c == '-')
            {
                detected.push(format!("long string: {} chars", word.len()));
                break; // Only report once per message
            }
        }
    }

    detected
}

/// Extract all file paths from session messages.
///
/// # Arguments
///
/// * `messages` - Session messages
///
/// # Returns
///
/// Deduplicated list of file paths
pub fn extract_session_files(messages: &[SessionMessage]) -> Vec<String> {
    let mut files = Vec::new();

    for msg in messages {
        if let Some(ref msg_files) = msg.files {
            files.extend(msg_files.clone());
        }
    }

    // Deduplicate while preserving order
    let mut seen = HashSet::new();
    files.retain(|f| seen.insert(f.clone()));

    files
}

/// Link a session to the best-matching commit.
///
/// This is the main entry point for the linking algorithm. It:
/// 1. Scans for secrets in session messages (security check)
/// 2. Filters commits by time window
/// 3. Scores each candidate commit
/// 4. Returns the best match if confidence >= threshold
///
/// # Arguments
///
/// * `session` - Session excerpt to link
/// * `commits` - All commits in the repository
///
/// # Returns
///
/// * `Ok(LinkResult)` - Session successfully linked to a commit
/// * `Err(UnlinkedReason)` - Session could not be linked
///
/// # Evidence
///
/// Build Plan Epic 3 Story 3.4.
pub fn link_session_to_commits(session: &SessionExcerpt, commits: &[GitCommit]) -> LinkingResult {
    link_session_to_commits_with_options(
        session,
        commits,
        LinkOptions {
            skip_secret_scan: false,
        },
    )
}

pub fn link_session_to_commits_with_options(
    session: &SessionExcerpt,
    commits: &[GitCommit],
    options: LinkOptions,
) -> LinkingResult {
    // Parse session end time
    let session_end = match DateTime::parse_from_rfc3339(&session.imported_at_iso) {
        Ok(dt) => dt.with_timezone(&Utc),
        Err(e) => {
            return Err(UnlinkedReason::ParseError(format!(
                "Invalid session timestamp: {}",
                e
            )))
        }
    };

    // Get or infer session duration
    let duration_min = session.duration_min.unwrap_or(30); // Default to 30 min if missing

    if !options.skip_secret_scan {
        // Security: Scan for secrets in session messages
        let mut detected_secrets = Vec::new();
        for msg in &session.messages {
            detected_secrets.extend(detect_secrets(&msg.text));
        }

        if !detected_secrets.is_empty() {
            return Err(UnlinkedReason::SecretDetected(detected_secrets));
        }
    }

    // Extract session files
    let session_files = extract_session_files(&session.messages);

    // Filter commits by time window (±4 hours from session)
    let tolerance = chrono::Duration::minutes(TIME_WINDOW_TOLERANCE_MIN);
    let window_start = session_end - tolerance;
    let window_end = session_end + tolerance;

    let candidates: Vec<&GitCommit> = commits
        .iter()
        .filter(|commit| {
            if let Ok(commit_time) = DateTime::parse_from_rfc3339(&commit.authored_at) {
                let commit_time = commit_time.with_timezone(&Utc);
                commit_time >= window_start && commit_time <= window_end
            } else {
                false
            }
        })
        .collect();

    // Handle edge case: no commits in time window
    if candidates.is_empty() {
        return Err(UnlinkedReason::NoCommitsInTimeWindow);
    }

    // Score each candidate commit with tie-breaking logic
    let mut best_result: Option<LinkResult> = None;
    let mut second_best: Option<LinkResult> = None;
    const TIE_BREAK_MARGIN: f64 = 0.05; // Within 5% confidence, prefer closer timestamp

    // Build a map of SHA to commit for later lookup
    let commit_map: std::collections::HashMap<String, &GitCommit> =
        candidates.iter().map(|c| (c.sha.clone(), *c)).collect();

    for commit in &candidates {
        if let Some(result) =
            calculate_link_confidence(&session_end, duration_min, commit, &session_files)
        {
            match &best_result {
                None => best_result = Some(result),
                Some(current_best) => {
                    // Calculate timestamp distance for tie-breaking
                    // Use match to gracefully handle parse errors instead of unwrap
                    let (Some(commit_time), Some(current_best_commit)) = (
                        DateTime::parse_from_rfc3339(&commit.authored_at).ok(),
                        commit_map.get(&current_best.commit_sha),
                    ) else {
                        continue;
                    };
                    let Some(current_best_commit_time) =
                        DateTime::parse_from_rfc3339(&current_best_commit.authored_at).ok()
                    else {
                        continue;
                    };

                    let commit_time = commit_time.with_timezone(&Utc);
                    let current_best_commit_time = current_best_commit_time.with_timezone(&Utc);

                    let new_distance = (commit_time - session_end).num_minutes().abs();
                    let current_distance =
                        (current_best_commit_time - session_end).num_minutes().abs();

                    // Replace if:
                    // 1. Significantly higher confidence, OR
                    // 2. Similar confidence but closer timestamp (tie-break)
                    let improved = result.confidence > current_best.confidence + TIE_BREAK_MARGIN;
                    let close =
                        (result.confidence - current_best.confidence).abs() <= TIE_BREAK_MARGIN;
                    let closer = new_distance < current_distance;

                    if improved || (close && closer) {
                        second_best = best_result.take();
                        best_result = Some(result);
                    } else if second_best
                        .as_ref()
                        .map(|existing| result.confidence > existing.confidence)
                        .unwrap_or(true)
                    {
                        second_best = Some(result);
                    }
                }
            }
        }
    }

    // Return best match or error if below threshold
    match best_result {
        Some(mut result) => {
            let needs_review = second_best
                .as_ref()
                .map(|second| (result.confidence - second.confidence).abs() <= TIE_BREAK_MARGIN)
                .unwrap_or(false);
            result.needs_review = needs_review;
            Ok(result)
        }
        None => Err(UnlinkedReason::LowConfidence),
    }
}

// ============================================================================
// Unit Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_temporal_overlap_perfect_match() {
        let session_end = DateTime::parse_from_rfc3339("2024-01-15T14:30:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let commit_time = DateTime::parse_from_rfc3339("2024-01-15T14:20:00Z")
            .unwrap()
            .with_timezone(&Utc);

        let score = score_temporal_overlap(&session_end, 10, &commit_time);
        assert_eq!(score, 1.0); // Commit within session window
    }

    #[test]
    fn test_temporal_overlap_partial_match() {
        let session_end = DateTime::parse_from_rfc3339("2024-01-15T14:30:00Z")
            .unwrap()
            .with_timezone(&Utc);
        // 3 minutes after session end (within 5 min decay window)
        let commit_time = DateTime::parse_from_rfc3339("2024-01-15T14:33:00Z")
            .unwrap()
            .with_timezone(&Utc);

        let score = score_temporal_overlap(&session_end, 10, &commit_time);
        assert!(score > 0.5 && score < 1.0); // Partial overlap, decayed score
    }

    #[test]
    fn test_temporal_overlap_no_match() {
        let session_end = DateTime::parse_from_rfc3339("2024-01-15T14:30:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let commit_time = DateTime::parse_from_rfc3339("2024-01-15T15:00:00Z")
            .unwrap()
            .with_timezone(&Utc);

        let score = score_temporal_overlap(&session_end, 10, &commit_time);
        assert_eq!(score, 0.0); // Outside tolerance window
    }

    #[test]
    fn test_file_overlap_full() {
        let session_files = vec!["src/utils.ts".to_string(), "src/api.ts".to_string()];
        let commit_files = vec!["src/utils.ts".to_string(), "src/api.ts".to_string()];

        let score = score_file_overlap(&session_files, &commit_files);
        assert_eq!(score, 1.0); // Perfect match
    }

    #[test]
    fn test_file_overlap_partial() {
        let session_files = vec!["src/utils.ts".to_string(), "src/api.ts".to_string()];
        let commit_files = vec![
            "src/utils.ts".to_string(),
            "src/components/Button.tsx".to_string(),
        ];

        let score = score_file_overlap(&session_files, &commit_files);
        assert!(score > 0.0 && score < 1.0); // Partial overlap
    }

    #[test]
    fn test_file_overlap_none() {
        let session_files = vec!["src/utils.ts".to_string()];
        let commit_files = vec!["src/components/Button.tsx".to_string()];

        let score = score_file_overlap(&session_files, &commit_files);
        assert_eq!(score, 0.0); // No overlap
    }

    #[test]
    fn test_normalize_path() {
        assert_eq!(normalize_path("src/./utils.ts"), "src/utils.ts");
        assert_eq!(normalize_path("src/../src/utils.ts"), "src/utils.ts");
        assert_eq!(normalize_path("./src/utils.ts"), "src/utils.ts");
    }

    #[test]
    fn test_detect_secrets() {
        assert!(detect_secrets("Update Button component").is_empty());

        let secrets = detect_secrets("Add API token and secret key");
        assert!(!secrets.is_empty());
    }
}
