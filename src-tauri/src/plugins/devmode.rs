use ares_connection_lib::transfer::FileTransfer;
use regex::Regex;
use serde::{Deserialize, Serialize};
use tauri::plugin::{Builder, TauriPlugin};
use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_http::reqwest;
use tauri_plugin_http::reqwest::Url;

use crate::device_manager::Device;
use crate::error::Error;
use crate::session_manager::SessionManager;

#[derive(Serialize)]
pub struct DevModeStatus {
    token: Option<String>,
    remaining: Option<String>,
}

#[derive(Deserialize)]
struct DevModeSession {
    result: String,
    #[serde(rename = "errorCode")]
    error_code: Option<String>,
    #[serde(rename = "errorMsg")]
    error_msg: Option<String>,
}

#[tauri::command]
async fn token<R: Runtime>(app: AppHandle<R>, device: Device) -> Result<String, Error> {
    if device.username != "prisoner" {
        return Err(Error::Unsupported);
    }
    if let Some(token) = valid_token(app, device).await? {
        return Ok(token);
    }
    Err(Error::Unsupported)
}

#[tauri::command]
async fn status<R: Runtime>(app: AppHandle<R>, device: Device) -> Result<DevModeStatus, Error> {
    let Some(token) = valid_token(app, device).await? else {
        return Ok(DevModeStatus {
            token: None,
            remaining: None,
        });
    };
    let resp = reqwest::get(
        Url::parse_with_params(
            "https://developer.lge.com/secure/CheckDevModeSession.dev",
            &[("sessionToken", &token)],
        )
        .expect("Illegal HTTP URL"),
    )
    .await?
    .error_for_status()?;
    let session = resp.json::<DevModeSession>().await?;
    if session.result == "success" {
        return Ok(DevModeStatus {
            token: Some(token),
            remaining: Some(session.error_msg.unwrap_or(String::from(""))),
        });
    }
    log::info!(
        "DevMode session non-success status: errorCode={:?}, errorMsg={:?}",
        session.error_code,
        session.error_msg
    );
    Ok(DevModeStatus {
        token: Some(token),
        remaining: None,
    })
}

async fn valid_token<R: Runtime>(
    app: AppHandle<R>,
    device: Device,
) -> Result<Option<String>, Error> {
    let data = tauri::async_runtime::spawn_blocking(move || {
        let sessions = app.state::<SessionManager>();
        return sessions.with_session(device, |session| {
            let mut data = Vec::<u8>::new();
            session.get("/var/luna/preferences/devmode_enabled", &mut data, |_| {})?;
            return Ok::<Vec<u8>, Error>(data);
        });
    })
    .await
    .unwrap()?;
    parse_devmode_token(&data)
}

/// The TV stores the token with a trailing newline; trim it before validating.
fn parse_devmode_token(data: &[u8]) -> Result<Option<String>, Error> {
    let token = match std::str::from_utf8(data) {
        Ok(token) => token.trim().to_string(),
        Err(e) => {
            return Err(Error::IO {
                code: std::io::ErrorKind::InvalidData,
                message: format!("Can't read dev mode token: {}", e),
                unhandled: true,
            })
        }
    };
    let regex = Regex::new("^[0-9a-zA-Z]+$").unwrap();
    if !regex.is_match(&token) {
        log::warn!("DevMode token has an invalid format");
        return Ok(None);
    }
    Ok(Some(token))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_with_trailing_newline_is_valid() {
        assert_eq!(
            parse_devmode_token(b"abc123Z\n").unwrap(),
            Some("abc123Z".to_string())
        );
        assert_eq!(
            parse_devmode_token(b"abc123Z\r\n").unwrap(),
            Some("abc123Z".to_string())
        );
    }

    #[test]
    fn plain_token_is_valid() {
        assert_eq!(
            parse_devmode_token(b"abc123Z").unwrap(),
            Some("abc123Z".to_string())
        );
    }

    #[test]
    fn token_with_bad_characters_is_rejected() {
        for data in [&b"abc123Z!\n"[..], &b"abc 123Z\n"[..], &b""[..], &b"\n"[..]] {
            assert_eq!(parse_devmode_token(data).unwrap(), None);
        }
    }

    #[test]
    fn non_utf8_token_is_an_error() {
        assert!(parse_devmode_token(&[0xff, 0xfe]).is_err());
    }
}

/// Initializes the plugin.
pub fn plugin<R: Runtime>(name: &'static str) -> TauriPlugin<R> {
    Builder::new(name)
        .invoke_handler(tauri::generate_handler![status, token])
        .build()
}
