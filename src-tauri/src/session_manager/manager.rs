use std::path::Path;
use std::sync::{Arc, Condvar, Mutex};

use crate::conn_pool::{DeviceConnectionPool, ManagedDeviceConnection};
use crate::device_manager::Device;
use crate::error::Error;
use crate::session_manager::{Proc, SessionManager};

impl SessionManager {
    pub fn session(&self, device: Device) -> Result<ManagedDeviceConnection, Error> {
        self.pool(device).get()
    }

    pub fn with_session<T, F>(&self, device: Device, action: F) -> Result<T, Error>
    where
        F: Fn(&ManagedDeviceConnection) -> Result<T, Error>,
    {
        let pool = self.pool(device);
        // Mirror the pool's own retry budget: a device that accepts TCP and then
        // drops every session must not spin forever.
        for _ in 0..3 {
            let session = pool.get()?;
            return match action(&session) {
                Ok(ret) => {
                    session.mark_last_ok();
                    Ok(ret)
                }
                Err(Error::Disconnected) => {
                    continue;
                }
                Err(e) => Err(e),
            };
        }
        Err(Error::Disconnected)
    }

    pub fn spawn(&self, device: Device, command: &str) -> Proc {
        Proc {
            device,
            command: String::from(command),
            callback: Mutex::default(),
            ready: Arc::new((Mutex::default(), Condvar::new())),
            sender: Mutex::default(),
            interrupted: Mutex::new(false),
        }
    }

    pub fn forget_device(&self, name: &str) {
        self.pools.lock().unwrap().remove(name);
    }

    fn pool(&self, device: Device) -> DeviceConnectionPool {
        if device.new {
            return DeviceConnectionPool::new(device, self.ssh_dir.get().map(Path::to_path_buf));
        }
        let mut pools = self
            .pools
            .lock()
            .expect("Failed to lock SessionManager::pools");
        let config = serde_json::to_value(&device).expect("Failed to serialize device");
        let entry = pools.entry(device.name.clone()).or_insert_with(|| {
            (
                config.clone(),
                DeviceConnectionPool::new(
                    device.clone(),
                    self.ssh_dir.get().map(Path::to_path_buf),
                ),
            )
        });
        if entry.0 != config {
            *entry = (
                config,
                DeviceConnectionPool::new(device, self.ssh_dir.get().map(Path::to_path_buf)),
            );
        }
        entry.1.clone()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::byte_string::Encoding;
    use crate::conn_pool::ExecuteCommand;
    use crate::tests::common::SshContainer;
    use std::sync::atomic::{AtomicUsize, Ordering};

    fn ssh_device(port: u16) -> Device {
        serde_json::from_str(&format!(
            "{{\"profile\":\"ose\",\"name\":\"tv\",\"host\":\"127.0.0.1\",\"port\":{port},\"username\":\"root\",\"password\":\"alpine\"}}"
        ))
        .unwrap()
    }

    #[test]
    fn forgetting_a_device_discards_its_cached_pool() {
        let manager = SessionManager::default();
        let device: Device = serde_json::from_str(
            r#"{"profile":"ose","name":"tv","host":"127.0.0.1","port":22,"username":"root"}"#,
        )
        .unwrap();
        manager.pool(device.clone());
        manager.forget_device("tv");
        assert!(manager.pools.lock().unwrap().is_empty());
        manager.pool(device);
        assert!(manager.pools.lock().unwrap().contains_key("tv"));
    }

    #[test]
    fn changed_connection_settings_replace_the_cached_pool() {
        let manager = SessionManager::default();
        let mut device: Device = serde_json::from_str(
            r#"{"profile":"ose","name":"tv","host":"127.0.0.1","port":22,"username":"root"}"#,
        )
        .unwrap();
        let original = manager.pool(device.clone());
        assert!(original.same_pool(&manager.pool(device.clone())));
        device.host = "127.0.0.2".to_string();
        let updated = manager.pool(device.clone());
        assert!(!original.same_pool(&updated));
        assert!(updated.same_pool(&manager.pool(device)));
        assert_eq!(manager.pools.lock().unwrap()["tv"].0["host"], "127.0.0.2");
    }

    #[test]
    fn with_session_bounds_disconnected_retries() {
        let sshd = SshContainer::new();
        let port = sshd.wait();
        let device = ssh_device(port);
        let calls = AtomicUsize::new(0);
        let result: Result<(), Error> = SessionManager::default().with_session(device, |_| {
            calls.fetch_add(1, Ordering::SeqCst);
            Err(Error::Disconnected)
        });
        assert_eq!(result, Err(Error::Disconnected));
        assert!(calls.load(Ordering::SeqCst) <= 3);
    }

    #[test]
    fn with_session_recovers_after_ssh_session_drop() {
        let sshd = SshContainer::new();
        let port = sshd.wait();
        let manager = SessionManager::default();
        let device = ssh_device(port);
        let run = || {
            manager.with_session(device.clone(), |session| {
                session.execute_command("printf connected", None, Encoding::String)
            })
        };
        assert_eq!(run().unwrap().stdout.as_ref(), b"connected");
        sshd.disconnect_sessions();
        assert_eq!(run().unwrap().stdout.as_ref(), b"connected");
    }
}
