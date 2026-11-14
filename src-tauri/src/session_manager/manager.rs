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
        loop {
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
}
