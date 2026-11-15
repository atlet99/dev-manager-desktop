use crate::session_manager::Proc;
use crate::spawn_manager::SpawnManager;
use std::sync::Arc;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::device_manager::Device;
    use crate::session_manager::SessionManager;

    fn device(name: &str) -> Device {
        serde_json::from_str(&format!(
            "{{\"profile\":\"ose\",\"name\":\"{name}\",\"host\":\"127.0.0.1\",\"port\":22,\"username\":\"root\"}}"
        ))
        .unwrap()
    }

    #[test]
    fn adding_a_process_prunes_dead_entries() {
        let manager = SpawnManager::default();
        let session_manager = SessionManager::default();
        {
            let proc = Arc::new(session_manager.spawn(device("first"), "/bin/true"));
            manager.add_proc(proc);
        } // last strong reference goes out of scope here
        manager.add_proc(Arc::new(session_manager.spawn(device("second"), "/bin/true")));
        // the first process is dead: adding the second must have pruned it
        assert_eq!(manager.items.lock().unwrap().len(), 1);
    }
}

impl SpawnManager {
    pub fn add_proc(&self, proc: Arc<Proc>) {
        let mut guard = self
            .items
            .lock()
            .expect("Failed to lock SpawnManager::items");
        guard.retain(|entry| entry.upgrade().is_some());
        guard.push(Arc::downgrade(&proc))
    }

    pub fn clear(&self) {
        let mut guard = self
            .items
            .lock()
            .expect("Failed to lock SpawnManager::items");
        let old_items = std::mem::replace(&mut *guard, Vec::new());
        drop(guard);
        for x in old_items {
            if let Some(proc) = x.upgrade() {
                log::debug!("Terminating {proc:?}");
                proc.interrupt();
            }
        }
    }
}
