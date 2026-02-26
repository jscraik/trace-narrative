use serde::Serialize;

const REQUIRED_RESOURCE_SCHEME: &str = "narrative://";
const FORBIDDEN_SCOPE: &str = "*";

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum McpClientAuthError {
    InvalidResourceIndicator,
    MissingScope,
    InvalidScope,
    WildcardScopeNotAllowed,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct McpAuthorizationParams {
    pub resource_indicator: String,
    pub scope: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct McpClientConnectionConfig {
    pub resource_indicator: String,
    pub scopes: Vec<String>,
}

/// RFC 8707 requires a resource indicator for OAuth token requests.
/// We enforce a Narrative-owned URI scheme to constrain token audience.
pub fn validate_resource_indicator(resource_indicator: &str) -> Result<(), McpClientAuthError> {
    let normalized = resource_indicator.trim();
    if normalized.is_empty() {
        return Err(McpClientAuthError::InvalidResourceIndicator);
    }
    if normalized.contains(char::is_whitespace) {
        return Err(McpClientAuthError::InvalidResourceIndicator);
    }
    if !normalized.starts_with(REQUIRED_RESOURCE_SCHEME) {
        return Err(McpClientAuthError::InvalidResourceIndicator);
    }

    Ok(())
}

fn normalize_scopes(scopes: &[String]) -> Result<Vec<String>, McpClientAuthError> {
    let mut normalized: Vec<String> = Vec::new();

    for scope in scopes {
        let scope = scope.trim();
        if scope.is_empty() {
            continue;
        }

        if scope.chars().any(char::is_whitespace) {
            return Err(McpClientAuthError::InvalidScope);
        }

        normalized.push(scope.to_owned());
    }

    if normalized.is_empty() {
        return Err(McpClientAuthError::MissingScope);
    }

    if normalized.iter().any(|scope| scope == FORBIDDEN_SCOPE) {
        return Err(McpClientAuthError::WildcardScopeNotAllowed);
    }

    normalized.sort();
    normalized.dedup();

    Ok(normalized)
}

pub fn build_initialize_authorization(
    resource_indicator: &str,
    scopes: &[String],
) -> Result<McpAuthorizationParams, McpClientAuthError> {
    validate_resource_indicator(resource_indicator)?;
    let normalized_scopes = normalize_scopes(scopes)?;

    Ok(McpAuthorizationParams {
        resource_indicator: resource_indicator.trim().to_string(),
        scope: normalized_scopes.join(" "),
    })
}

/// Build OAuth token request fields with RFC 8707 `resource` parameter.
pub fn build_oauth_token_request_form(
    resource_indicator: &str,
    scopes: &[String],
) -> Result<Vec<(String, String)>, McpClientAuthError> {
    let authorization = build_initialize_authorization(resource_indicator, scopes)?;

    Ok(vec![
        ("grant_type".to_string(), "client_credentials".to_string()),
        (
            "resource".to_string(),
            authorization.resource_indicator.clone(),
        ),
        ("scope".to_string(), authorization.scope),
    ])
}

pub fn connect_with_resource_indicators(
    resource_indicator: &str,
    scopes: &[String],
) -> Result<McpClientConnectionConfig, McpClientAuthError> {
    validate_resource_indicator(resource_indicator)?;
    let scopes = normalize_scopes(scopes)?;

    Ok(McpClientConnectionConfig {
        resource_indicator: resource_indicator.trim().to_string(),
        scopes,
    })
}

#[cfg(test)]
mod tests {
    use super::{
        build_initialize_authorization, build_oauth_token_request_form,
        connect_with_resource_indicators, validate_resource_indicator, McpClientAuthError,
    };

    #[test]
    fn rejects_scopes_with_internal_whitespace() {
        let scopes = vec!["session read".to_string()];
        assert_eq!(
            connect_with_resource_indicators("narrative://session-capture", &scopes),
            Err(McpClientAuthError::InvalidScope)
        );
    }

    #[test]
    fn validates_narrative_resource_indicators() {
        assert!(validate_resource_indicator("narrative://session-capture").is_ok());
        assert_eq!(
            validate_resource_indicator("https://example.com/resource"),
            Err(McpClientAuthError::InvalidResourceIndicator)
        );
    }

    #[test]
    fn rejects_wildcard_scope() {
        let scopes = vec!["*".to_string()];
        assert_eq!(
            build_initialize_authorization("narrative://session-capture", &scopes),
            Err(McpClientAuthError::WildcardScopeNotAllowed)
        );
    }

    #[test]
    fn oauth_form_includes_rfc_8707_resource_parameter() {
        let scopes = vec!["sessions:read".to_string(), "sessions:write".to_string()];
        let form = build_oauth_token_request_form("narrative://session-capture", &scopes)
            .expect("valid oauth form");

        assert!(form.contains(&(
            "resource".to_string(),
            "narrative://session-capture".to_string()
        )));
        assert!(form.contains(&(
            "scope".to_string(),
            "sessions:read sessions:write".to_string()
        )));
    }

    #[test]
    fn connection_config_deduplicates_scopes() {
        let scopes = vec![
            "sessions:write".to_string(),
            "sessions:read".to_string(),
            "sessions:read".to_string(),
        ];

        let connection = connect_with_resource_indicators("narrative://session-capture", &scopes)
            .expect("valid connection config");

        assert_eq!(
            connection.scopes,
            vec!["sessions:read".to_string(), "sessions:write".to_string()]
        );
    }
}
