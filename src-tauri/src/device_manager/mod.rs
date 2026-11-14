use serde::{Deserialize, Serialize};

use crate::app_dirs::DirSlot;

mod manager;
pub mod privkey;

// Device, its key and its file transfer mode are shared with the ares-cli-rs
// tools. Reading and writing the device list is shared too, through
// ares_device_lib::DeviceManager. Only how a key name is resolved differs,
// which lives in privkey.rs.
pub use ares_device_lib::{Device, FileTransfer as DeviceFileTransfer, PrivateKey};

#[derive(Default)]
pub struct DeviceManager {
    pub ssh_dir: DirSlot,
    pub conf_dir: DirSlot,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PrivateKeyInfo {
    pub sha1: String,
    pub sha256: String,
}
