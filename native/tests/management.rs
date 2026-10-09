use ts4_mod_manager_native::settings::Settings;
#[test]
fn settings_transfer_omits_key_and_rejects_unknown_schema() {
    let settings=Settings::parse(r#"{"version":1,"theme":"system","gameRoots":["/game"],"curseforgeApiKey":"fixture-secret"}"#).unwrap();
    assert!(!settings.export(false).unwrap().contains("fixture-secret"));
    assert!(settings.export(true).unwrap().contains("fixture-secret"));
    assert!(Settings::parse(r#"{"version":2,"theme":"system","gameRoots":[]}"#).is_err());
    assert!(Settings::parse(r#"{"version":1,"theme":"custom","gameRoots":[]}"#).is_err());
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("settings.json");
    settings.save(&path).unwrap();
    assert_eq!(Settings::load(&path).unwrap().game_roots, vec!["/game"]);
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        assert_eq!(
            std::fs::metadata(path).unwrap().permissions().mode() & 0o777,
            0o600
        );
    }
}
#[test]
fn approved_queue_survives_worker_drop() {
    use ts4_mod_manager_native::management::{Action, Identity, Job, Mutations};
    let dir = tempfile::tempdir().unwrap();
    let source = dir.path().join("source");
    std::fs::create_dir(&source).unwrap();
    std::fs::write(source.join("a.package"), b"fixture").unwrap();
    let managed = dir.path().join("managed");
    let root = dir.path().join("game");
    std::fs::create_dir_all(root.join("Mods")).unwrap();
    let worker = Mutations::start(|| {}).unwrap();
    for operation in 1..=2 {
        worker
            .submit(Job {
                identity: Identity {
                    operation,
                    root: root.clone(),
                    entry: None,
                    generation: 1,
                },
                managed: managed.clone(),
                trash: dir.path().join("trash"),
                action: Action::ImportFolder {
                    path: source.clone(),
                    name: format!("Mod {operation}"),
                },
            })
            .unwrap();
    }
    drop(worker);
    assert_eq!(std::fs::read_dir(managed.join("mods")).unwrap().count(), 2);
}
#[test]
fn settings_normalize_roots_and_reject_relative_paths() {
    let settings=Settings::parse(r#"{"version":1,"theme":"system","gameRoots":["/game/./folder/","/game/folder"],"selectedRoot":"/game/folder/"}"#).unwrap();
    assert_eq!(settings.game_roots, vec!["/game/folder"]);
    assert_eq!(settings.selected_root.as_deref(), Some("/game/folder"));
    assert!(Settings::parse(r#"{"version":1,"theme":"light","gameRoots":["relative"]}"#).is_err());
}
#[test]
fn scoped_identity_requires_same_root_entry_and_generation() {
    use ts4_mod_manager_native::{catalog::EntryId, management::Identity};
    let root: std::path::PathBuf = "/a".into();
    let entry = EntryId::Managed("same".into());
    let id = Identity {
        operation: 1,
        root: root.clone(),
        entry: Some(entry.clone()),
        generation: 3,
    };
    assert!(id.current(Some(&root), Some(&entry), 3));
    assert!(!id.current(Some(&"/b".into()), Some(&entry), 3));
    assert!(!id.current(Some(&root), Some(&EntryId::External("same".into())), 3));
    assert!(!id.current(Some(&root), Some(&entry), 4));
}
#[test]
fn manual_source_rejects_credentials_before_metadata_write() {
    use ts4_mod_manager_native::catalog::EntryId;
    use ts4_mod_manager_native::management::{Action, Identity, Job, execute};
    let dir = tempfile::tempdir().unwrap();
    let job = Job {
        identity: Identity {
            operation: 1,
            root: dir.path().join("game"),
            entry: Some(EntryId::Managed("fixture".into())),
            generation: 1,
        },
        managed: dir.path().join("managed"),
        trash: dir.path().join("trash"),
        action: Action::ManualSource("https://user:secret@example.org/test".into()),
    };
    let Err(error) = execute(&job) else {
        panic!("credential URL accepted")
    };
    assert!(error.contains("credentials"));
    assert!(!job.managed.exists());
}
#[test]
fn malformed_settings_remain_unchanged_and_errors_hide_secrets() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("settings.json");
    let raw = b"{ secret-fixture-key malformed";
    std::fs::write(&path, raw).unwrap();
    let Err(error) = Settings::load(&path) else {
        panic!("invalid settings accepted")
    };
    assert!(!error.contains("secret-fixture-key"));
    assert_eq!(std::fs::read(path).unwrap(), raw);
}
#[test]
fn settings_save_rejects_invalid_in_memory_roots_before_touching_disk() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("new/settings.json");
    let settings = Settings {
        game_roots: vec!["relative".into()],
        ..Default::default()
    };
    assert!(settings.save(&path).is_err());
    assert!(!path.parent().unwrap().exists());
}
