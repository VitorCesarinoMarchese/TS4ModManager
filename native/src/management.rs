use crate::catalog::EntryId;
use std::{path::PathBuf, sync::mpsc, thread::JoinHandle};
use ts4_mod_manager_core::{
    managed_storage as storage, source_candidates::SourceCandidate, toggle,
};
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Identity {
    pub operation: u64,
    pub root: PathBuf,
    pub entry: Option<EntryId>,
    pub generation: u64,
}
impl Identity {
    pub fn current(
        &self,
        root: Option<&PathBuf>,
        entry: Option<&EntryId>,
        generation: u64,
    ) -> bool {
        Some(&self.root) == root && self.entry.as_ref() == entry && self.generation == generation
    }
}
#[derive(Clone)]
pub enum Action {
    ImportFolder { path: PathBuf, name: String },
    ImportZip { path: PathBuf, name: String },
    ReviewToggle { enabled: bool },
    Toggle { enabled: bool, review: String },
    Migrate { files: Vec<String> },
    Rename(String),
    ManualSource(String),
    Attach(SourceCandidate),
    RemoveSource,
    Trash,
    ListTrash,
    Restore(String),
    Lookup(Option<String>),
}
impl Action {
    pub fn label(&self) -> &str {
        match self {
            Self::ImportFolder { .. } => "Import folder",
            Self::ImportZip { .. } => "Import ZIP",
            Self::ReviewToggle { enabled: true } | Self::Toggle { enabled: true, .. } => "Enable",
            Self::ReviewToggle { enabled: false } | Self::Toggle { enabled: false, .. } => {
                "Disable"
            }
            Self::Migrate { .. } => "Manage external mod",
            Self::Rename(_) => "Rename",
            Self::ManualSource(_) | Self::Attach(_) => "Attach source",
            Self::RemoveSource => "Remove source",
            Self::Trash => "Move to trash",
            Self::ListTrash => "Read trash",
            Self::Restore(_) => "Restore",
            Self::Lookup(_) => "Find source",
        }
    }
}
#[derive(Clone)]
pub struct Job {
    pub identity: Identity,
    pub managed: PathBuf,
    pub trash: PathBuf,
    pub action: Action,
}
pub enum Output {
    Changed(Vec<String>),
    Review(toggle::DryRunResult),
    Candidates(Vec<SourceCandidate>),
    Trash(Vec<ts4_mod_manager_core::lifecycle::TrashEntry>),
}
pub enum Event {
    Recovered(Result<Vec<String>, String>),
    Running(Identity),
    Finished(Identity, Result<Output, String>),
}
pub struct Mutations {
    sender: Option<mpsc::Sender<Job>>,
    lookups: Option<mpsc::Sender<Job>>,
    results: mpsc::Receiver<Event>,
    thread: Option<JoinHandle<()>>,
}
impl Mutations {
    pub fn start(wake: impl Fn() + Send + Sync + 'static) -> std::io::Result<Self> {
        Self::start_worker(None, wake)
    }
    pub fn start_with_recovery(
        managed: PathBuf,
        wake: impl Fn() + Send + Sync + 'static,
    ) -> std::io::Result<Self> {
        Self::start_worker(Some(managed), wake)
    }
    fn start_worker(
        recovery: Option<PathBuf>,
        wake: impl Fn() + Send + Sync + 'static,
    ) -> std::io::Result<Self> {
        Self::start_executor(recovery, wake, execute)
    }
    fn start_executor(
        recovery: Option<PathBuf>,
        wake: impl Fn() + Send + Sync + 'static,
        execute: impl Fn(&Job) -> Result<Output, String> + Send + Sync + 'static,
    ) -> std::io::Result<Self> {
        let wake = std::sync::Arc::new(wake);
        let execute = std::sync::Arc::new(execute);
        let (sender, inbox) = mpsc::channel::<Job>();
        let (out, results) = mpsc::channel();
        let (lookup_sender, lookup_inbox) = mpsc::channel::<Job>();
        let lookup_out = out.clone();
        let lookup_wake = wake.clone();
        let lookup_execute = execute.clone();
        // Source requests are read-only. Closing the app must not wait on DNS or provider IO.
        std::thread::Builder::new().name("source-lookups".into()).spawn(move || {
            while let Ok(job) = lookup_inbox.recv() {
                if lookup_out.send(Event::Running(job.identity.clone())).is_err() { break; }
                lookup_wake();
                let result = lookup_execute(&job);
                if lookup_out.send(Event::Finished(job.identity, result)).is_err() { break; }
                lookup_wake();
            }
        })?;
        let thread = std::thread::Builder::new()
            .name("approved-management-fifo".into())
            .spawn(move || {
                if let Some(managed) = recovery {
                    let result = ts4_mod_manager_core::operation::recover_pending(&managed)
                        .map(|issues| issues.into_iter().map(|i| i.message).collect())
                        .map_err(|e| format!("{}: {}", e.code.as_str(), e.message));
                    let _ = out.send(Event::Recovered(result));
                    wake();
                }
                while let Ok(job) = inbox.recv() {
                    let _ = out.send(Event::Running(job.identity.clone()));
                    wake();
                    let result = execute(&job);
                    let _ = out.send(Event::Finished(job.identity, result));
                    wake();
                }
            })?;
        Ok(Self {
            sender: Some(sender),
            lookups: Some(lookup_sender),
            results,
            thread: Some(thread),
        })
    }
    pub fn submit(&self, job: Job) -> Result<(), String> {
        let sender = if matches!(job.action, Action::Lookup(_)) { &self.lookups } else { &self.sender };
        sender.as_ref()
            .ok_or("Management worker stopped")?
            .send(job)
            .map_err(|_| "Management worker stopped".into())
    }
    pub fn drain(&self) -> impl Iterator<Item = Event> + '_ {
        self.results.try_iter()
    }
}
impl Drop for Mutations {
    fn drop(&mut self) {
        self.lookups.take();
        self.sender.take();
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }
}
fn id(job: &Job) -> Result<&str, String> {
    match job.identity.entry.as_ref() {
        Some(EntryId::Managed(id)) => Ok(id),
        _ => Err("Select a managed mod first".into()),
    }
}
fn changed() -> Result<Output, String> {
    Ok(Output::Changed(vec![]))
}
pub fn execute(job: &Job) -> Result<Output, String> {
    let mods = job.identity.root.join("Mods");
    let managed = &job.managed;
    let error = |e: ts4_mod_manager_core::error::ManagerError| {
        format!("{}: {}", e.code.as_str(), e.message)
    };
    match &job.action {
        Action::ImportFolder { path, name } => {
            storage::create_managed_mod(
                managed,
                storage::ImportRequest {
                    name: name.clone(),
                    slug: None,
                    source_dir: path.clone(),
                },
            )
            .map_err(error)?;
            changed()
        }
        Action::ImportZip { path, name } => {
            ts4_mod_manager_core::archive_import::import_archive_to_managed(
                managed,
                path,
                name.clone(),
                None,
            )
            .map_err(error)?;
            changed()
        }
        Action::ReviewToggle { enabled } => Ok(Output::Review(
            toggle::dry_run_toggle(managed, &mods, id(job)?, *enabled).map_err(error)?,
        )),
        Action::Toggle { enabled, review } => {
            let _authority = ts4_mod_manager_core::operation::acquire(managed).map_err(error)?;
            let current =
                toggle::dry_run_toggle(managed, &mods, id(job)?, *enabled).map_err(error)?;
            if !current.can_apply
                || serde_json::to_string(&current).map_err(|e| e.to_string())? != *review
            {
                return Err(
                    "Files changed since review. Review the paths again before applying.".into(),
                );
            }
            let result = toggle::apply_toggle(managed, &mods, id(job)?, *enabled).map_err(error)?;
            if !result.applied {
                return Err(result
                    .issues
                    .iter()
                    .map(|i| i.message.clone())
                    .collect::<Vec<_>>()
                    .join("\n"));
            }
            Ok(Output::Changed(
                result.issues.into_iter().map(|i| i.message).collect(),
            ))
        }
        Action::Migrate { files } => {
            let _authority = ts4_mod_manager_core::operation::acquire(managed).map_err(error)?;
            let Some(EntryId::External(key)) = &job.identity.entry else {
                return Err("Select an external mod".into());
            };
            let current = ts4_mod_manager_core::mod_scan::scan_mods(&mods, managed).map_err(error)?
                .into_iter()
                .find(|m| m.key == *key)
                .ok_or("External mod no longer exists")?;
            if current.files != *files {
                return Err("External files changed. Review them again.".into());
            }
            let result =
                ts4_mod_manager_core::external_migration::migrate_external_mod(managed, &mods, key)
                    .map_err(error)?;
            Ok(Output::Changed(
                result.issues.into_iter().map(|i| i.message).collect(),
            ))
        }
        Action::Rename(name) => {
            storage::set_custom_display_name(managed, id(job)?, name.clone()).map_err(error)?;
            changed()
        }
        Action::ManualSource(url) => {
            let parsed = url::Url::parse(url).map_err(|_| "Enter a valid http or https URL")?;
            if !["http", "https"].contains(&parsed.scheme()) {
                return Err("Enter a valid http or https URL".into());
            }
            if !parsed.username().is_empty() || parsed.password().is_some() {
                return Err("Source URLs must not include credentials".into());
            }
            storage::set_source_url(managed, id(job)?, url.clone(), None, None, None, None)
                .map_err(error)?;
            changed()
        }
        Action::Attach(c) => {
            let attachment = storage::SourceAttachmentMetadata {
                provider_id: "curseforge".into(),
                project_id: c.project_id,
                file_id: c.file_id,
                source_url: c.source_url.clone(),
                title: c.title.clone(),
                author: c.author.clone(),
                confidence: Some(c.confidence),
                reasons: c.reasons.clone(),
                evidence: c
                    .evidence
                    .iter()
                    .map(|e| storage::SourceEvidence {
                        kind: e.kind.clone(),
                        description: e.description.clone(),
                        weight: e.weight,
                    })
                    .collect(),
                attached_by: "user".into(),
                attached_at: chrono::Utc::now().to_rfc3339(),
            };
            storage::set_source_url(
                managed,
                id(job)?,
                c.source_url.clone(),
                Some("curseforge".into()),
                None,
                c.preview_url.clone(),
                Some(attachment),
            )
            .map_err(error)?;
            changed()
        }
        Action::RemoveSource => {
            storage::remove_source_url(managed, id(job)?).map_err(error)?;
            changed()
        }
        Action::Trash => {
            storage::read_managed_mod(managed, id(job)?).map_err(error)?;
            let result = ts4_mod_manager_core::lifecycle::uninstall_managed_mod(
                managed,
                &mods,
                &job.trash,
                id(job)?,
            )
            .map_err(error)?;
            Ok(Output::Changed(
                result.issues.into_iter().map(|i| i.message).collect(),
            ))
        }
        Action::ListTrash => Ok(Output::Trash(
            ts4_mod_manager_core::lifecycle::list_trash_entries(&job.trash).map_err(error)?,
        )),
        Action::Restore(name) => {
            ts4_mod_manager_core::lifecycle::restore_trashed_mod(managed, &mods, &job.trash, name)
                .map_err(error)?;
            changed()
        }
        Action::Lookup(key) => Ok(Output::Candidates(
            ts4_mod_manager_core::source_lookup::find_source_candidates(
                managed,
                &mods,
                id(job)?,
                key.as_deref(),
            )
            .map_err(error)?,
        )),
    }
}

#[cfg(test)]
mod lookup_worker_tests {
    use super::*;
    use std::{sync::{Arc, Mutex}, time::Duration};

    #[test]
    fn stalled_lookup_does_not_block_local_jobs_or_shutdown() {
        let (entered, started) = mpsc::channel();
        let (release, stalled) = mpsc::channel();
        let stalled = Arc::new(Mutex::new(stalled));
        let worker = Mutations::start_executor(None, || {}, move |job| {
            if matches!(job.action, Action::Lookup(_)) {
                entered.send(()).unwrap();
                stalled.lock().unwrap().recv().unwrap();
            }
            Ok(Output::Changed(vec![]))
        }).unwrap();
        let make_job = |operation, action| Job {
            identity: Identity {operation, root: "fixture".into(), entry: None, generation: 1},
            managed: "managed".into(), trash: "trash".into(), action,
        };
        worker.submit(make_job(1, Action::Lookup(None))).unwrap();
        started.recv_timeout(Duration::from_secs(1)).unwrap();
        worker.submit(make_job(2, Action::ListTrash)).unwrap();
        let deadline = std::time::Instant::now() + Duration::from_secs(1);
        loop {
            if worker.drain().any(|event| matches!(event, Event::Finished(id, Ok(_)) if id.operation == 2)) { break; }
            assert!(std::time::Instant::now() < deadline, "local job blocked by source lookup");
            std::thread::yield_now();
        }
        let (closed, done) = mpsc::channel();
        std::thread::spawn(move || {drop(worker); closed.send(()).unwrap();});
        let result = done.recv_timeout(Duration::from_secs(1));
        release.send(()).unwrap();
        result.expect("shutdown must not wait for a read-only lookup");
    }
}
