use axum::http::HeaderMap;

const API_KEY_HEADER: &str = "x-mcp-api-key";
const AUTHORIZATION_HEADER: &str = "authorization";
const CLIENT_ID_HEADER: &str = "x-mcp-client-id";
const RESOURCE_INDICATOR_HEADER: &str = "x-mcp-resource-indicator";

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum McpTransport {
    Stdio,
    Http { port: u16 },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct McpServerConfig {
    pub transport: McpTransport,
    pub auth_required: bool,
    pub allowed_clients: Vec<String>,
    pub api_key: Option<String>,
    pub expected_resource_indicator: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ClientIdentity {
    pub client_id: String,
    pub authenticated: bool,
    pub resource_indicator: Option<String>,
}

impl ClientIdentity {
    fn anonymous(client_id: String) -> Self {
        Self {
            client_id,
            authenticated: false,
            resource_indicator: None,
        }
    }

    fn authenticated(client_id: String, resource_indicator: Option<String>) -> Self {
        Self {
            client_id,
            authenticated: true,
            resource_indicator,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum McpServerAuthError {
    AuthRequiredForHttpTransport,
    MissingServerApiKey,
    AuthRequired,
    InvalidCredentials,
    MissingClientId,
    ClientNotAllowed,
    MissingResourceIndicator,
    InvalidResourceIndicator,
}

pub fn validate_server_config(config: &McpServerConfig) -> Result<(), McpServerAuthError> {
    if matches!(config.transport, McpTransport::Http { .. }) {
        if !config.auth_required {
            return Err(McpServerAuthError::AuthRequiredForHttpTransport);
        }

        let has_api_key = config
            .api_key
            .as_ref()
            .map(|key| !key.trim().is_empty())
            .unwrap_or(false);
        if !has_api_key {
            return Err(McpServerAuthError::MissingServerApiKey);
        }
    }

    Ok(())
}

pub fn authenticate_client(
    headers: &HeaderMap,
    config: &McpServerConfig,
) -> Result<ClientIdentity, McpServerAuthError> {
    validate_server_config(config)?;

    let client_id = headers
        .get(CLIENT_ID_HEADER)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .ok_or(McpServerAuthError::MissingClientId)?;

    if !config.auth_required {
        return Ok(ClientIdentity::anonymous(client_id));
    }

    let expected_api_key = config
        .api_key
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .ok_or(McpServerAuthError::MissingServerApiKey)?;

    let provided_api_key = extract_api_key(headers).ok_or(McpServerAuthError::AuthRequired)?;
    if !constant_time_eq(provided_api_key.as_bytes(), expected_api_key.as_bytes()) {
        return Err(McpServerAuthError::InvalidCredentials);
    }

    if !config.allowed_clients.is_empty()
        && !config.allowed_clients.iter().any(|id| id == &client_id)
    {
        return Err(McpServerAuthError::ClientNotAllowed);
    }

    let resource_indicator = match config.expected_resource_indicator.as_ref() {
        Some(expected) => {
            let provided = headers
                .get(RESOURCE_INDICATOR_HEADER)
                .and_then(|value| value.to_str().ok())
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .ok_or(McpServerAuthError::MissingResourceIndicator)?;

            if provided != expected {
                return Err(McpServerAuthError::InvalidResourceIndicator);
            }

            Some(provided.to_string())
        }
        None => None,
    };

    Ok(ClientIdentity::authenticated(client_id, resource_indicator))
}

fn extract_api_key(headers: &HeaderMap) -> Option<String> {
    if let Some(value) = headers
        .get(API_KEY_HEADER)
        .and_then(|value| value.to_str().ok())
    {
        let key = value.trim();
        if !key.is_empty() {
            return Some(key.to_string());
        }
    }

    let auth_header = headers
        .get(AUTHORIZATION_HEADER)
        .and_then(|value| value.to_str().ok())?;

    let mut parts = auth_header.split_whitespace();
    let scheme = parts.next()?;
    let token = parts.next()?;

    if !scheme.eq_ignore_ascii_case("bearer") {
        return None;
    }
    if token.trim().is_empty() {
        return None;
    }

    Some(token.trim().to_string())
}

fn constant_time_eq(left: &[u8], right: &[u8]) -> bool {
    if left.len() != right.len() {
        return false;
    }

    let mut diff: u8 = 0;
    for (a, b) in left.iter().zip(right.iter()) {
        diff |= a ^ b;
    }
    diff == 0
}

#[cfg(test)]
mod tests {
    use super::{
        authenticate_client, validate_server_config, McpServerAuthError, McpServerConfig,
        McpTransport,
    };
    use axum::http::{HeaderMap, HeaderName, HeaderValue};

    fn headers(entries: &[(&str, &str)]) -> HeaderMap {
        let mut map = HeaderMap::new();
        for (key, value) in entries {
            map.insert(
                HeaderName::from_bytes(key.as_bytes()).expect("valid header name"),
                HeaderValue::from_str(value).expect("valid header value"),
            );
        }
        map
    }

    fn secure_http_config() -> McpServerConfig {
        McpServerConfig {
            transport: McpTransport::Http { port: 8787 },
            auth_required: true,
            allowed_clients: vec!["trusted-agent".to_string()],
            api_key: Some("secret-key".to_string()),
            expected_resource_indicator: Some("narrative://session-capture".to_string()),
        }
    }

    #[test]
    fn http_transport_requires_auth_and_api_key() {
        let insecure = McpServerConfig {
            transport: McpTransport::Http { port: 8787 },
            auth_required: false,
            allowed_clients: vec![],
            api_key: None,
            expected_resource_indicator: None,
        };
        assert_eq!(
            validate_server_config(&insecure),
            Err(McpServerAuthError::AuthRequiredForHttpTransport)
        );

        let missing_key = McpServerConfig {
            auth_required: true,
            ..insecure
        };
        assert_eq!(
            validate_server_config(&missing_key),
            Err(McpServerAuthError::MissingServerApiKey)
        );
    }

    #[test]
    fn rejects_missing_api_key_header() {
        let headers = headers(&[("x-mcp-client-id", "trusted-agent")]);
        assert_eq!(
            authenticate_client(&headers, &secure_http_config()),
            Err(McpServerAuthError::AuthRequired)
        );
    }

    #[test]
    fn rejects_invalid_credentials() {
        let headers = headers(&[
            ("x-mcp-client-id", "trusted-agent"),
            ("x-mcp-api-key", "wrong"),
            ("x-mcp-resource-indicator", "narrative://session-capture"),
        ]);

        assert_eq!(
            authenticate_client(&headers, &secure_http_config()),
            Err(McpServerAuthError::InvalidCredentials)
        );
    }

    #[test]
    fn rejects_resource_indicator_mismatch() {
        let headers = headers(&[
            ("x-mcp-client-id", "trusted-agent"),
            ("x-mcp-api-key", "secret-key"),
            ("x-mcp-resource-indicator", "narrative://wrong"),
        ]);

        assert_eq!(
            authenticate_client(&headers, &secure_http_config()),
            Err(McpServerAuthError::InvalidResourceIndicator)
        );
    }

    #[test]
    fn authenticates_valid_http_client() {
        let headers = headers(&[
            ("x-mcp-client-id", "trusted-agent"),
            ("x-mcp-api-key", "secret-key"),
            ("x-mcp-resource-indicator", "narrative://session-capture"),
        ]);

        let identity = authenticate_client(&headers, &secure_http_config())
            .expect("authentication should succeed");

        assert!(identity.authenticated);
        assert_eq!(identity.client_id, "trusted-agent");
        assert_eq!(
            identity.resource_indicator,
            Some("narrative://session-capture".to_string())
        );
    }

    #[test]
    fn stdio_transport_can_run_without_http_auth() {
        let config = McpServerConfig {
            transport: McpTransport::Stdio,
            auth_required: false,
            allowed_clients: vec![],
            api_key: None,
            expected_resource_indicator: None,
        };

        let headers = headers(&[("x-mcp-client-id", "local-agent")]);

        let identity = authenticate_client(&headers, &config).expect("stdio should be allowed");
        assert!(!identity.authenticated);
        assert_eq!(identity.client_id, "local-agent");
    }
}
