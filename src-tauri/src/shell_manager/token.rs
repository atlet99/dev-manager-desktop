use std::fmt;
use std::fmt::{Display, Formatter};
use std::str::FromStr;

use serde::de::Visitor;
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use uuid::Uuid;

use crate::shell_manager::ShellToken;

impl ShellToken {
    pub(crate) fn new() -> Self {
        ShellToken(Uuid::new_v4())
    }
}
impl Serialize for ShellToken {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&format!("{}", self.0))
    }
}

impl<'de> Deserialize<'de> for ShellToken {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        deserializer.deserialize_string(ShellTokenVisitor)
    }
}

struct ShellTokenVisitor;

impl<'de> Visitor<'de> for ShellTokenVisitor {
    type Value = ShellToken;

    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("string")
    }

    // parse the version from the string
    fn visit_str<E>(self, value: &str) -> Result<Self::Value, E>
    where
        E: serde::de::Error,
    {
        let uuid = Uuid::from_str(value).map_err(E::custom)?;
        Ok(ShellToken(uuid))
    }
}

impl Display for ShellToken {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shell_token_roundtrips_through_serde() {
        let token = ShellToken::new();
        let json = serde_json::to_string(&token).unwrap();
        let parsed: ShellToken = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.0, token.0);
    }

    #[test]
    fn shell_token_rejects_invalid_uuids() {
        for bad in ["", "not-a-uuid", "1234", "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"] {
            let result: Result<ShellToken, _> = serde_json::from_value(serde_json::json!(bad));
            assert!(result.is_err(), "expected error for {bad:?}");
        }
    }
}
