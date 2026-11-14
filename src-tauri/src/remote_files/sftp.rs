use std::time::UNIX_EPOCH;

use crate::conn_pool::DeviceConnectionUserInfo;
use libssh_rs::{FileType, Metadata};

use crate::remote_files::{FileItem, LinkInfo, PermInfo};

impl From<&Metadata> for FileItem {
    fn from(stat: &Metadata) -> Self {
        FileItem::new(stat, None, None)
    }
}

impl FileItem {
    pub(crate) fn new(stat: &Metadata, link: Option<LinkInfo>, access: Option<PermInfo>) -> Self {
        FileItem {
            filename: stat.name().unwrap_or("unknown").to_string(),
            r#type: format!(
                "{}",
                abbrev_type(stat.file_type().unwrap_or(FileType::Unknown))
            ),
            mode: unix_mode::to_string(stat.permissions().unwrap_or(0)),
            user: stat.owner().map(|s| String::from(s)),
            group: stat.group().map(|s| String::from(s)),
            size: stat.len().unwrap_or(0) as usize,
            mtime: mtime_secs(stat.modified()),
            link,
            access,
        }
    }
}

impl PermInfo {
    pub fn from(stat: &Metadata, user: &DeviceConnectionUserInfo) -> Self {
        let perms = stat.permissions().unwrap_or(0);
        if user.uid.id == stat.uid().unwrap_or(0) {
            return PermInfo {
                read: (perms & 0o400) != 0,
                write: (perms & 0o200) != 0,
                execute: (perms & 0o100) != 0,
            };
        }
        for group in &user.groups {
            if group.id == stat.gid().unwrap_or(0) {
                return PermInfo {
                    read: (perms & 0o040) != 0,
                    write: (perms & 0o020) != 0,
                    execute: (perms & 0o010) != 0,
                };
            }
        }
        if user.gid.id == stat.gid().unwrap_or(0) {
            return PermInfo {
                read: (perms & 0o040) != 0,
                write: (perms & 0o020) != 0,
                execute: (perms & 0o010) != 0,
            };
        }
        PermInfo {
            read: (perms & 0o004) != 0,
            write: (perms & 0o002) != 0,
            execute: (perms & 0o001) != 0,
        }
    }
}

fn mtime_secs(modified: Option<std::time::SystemTime>) -> f64 {
    modified
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_secs_f64())
        .unwrap_or(0.0)
}

fn abbrev_type(value: FileType) -> char {
    match value {
        FileType::Special => 'b',
        FileType::Directory => 'd',
        FileType::Regular => '-',
        FileType::Symlink => 'l',
        FileType::Unknown => ' ',
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{Duration, SystemTime};

    #[test]
    fn mtime_before_unix_epoch_does_not_panic() {
        assert_eq!(
            mtime_secs(Some(SystemTime::UNIX_EPOCH - Duration::from_secs(60))),
            0.0
        );
        assert_eq!(mtime_secs(None), 0.0);
        assert_eq!(mtime_secs(Some(SystemTime::UNIX_EPOCH)), 0.0);
    }

    #[test]
    fn mtime_reports_seconds_since_epoch() {
        assert_eq!(
            mtime_secs(Some(
                SystemTime::UNIX_EPOCH + Duration::from_secs(1_600_000_000)
            )),
            1_600_000_000.0
        );
    }
}
