use crate::{
    catalog::Catalog,
    management::{Action, Event, Identity, Job, Mutations, Output},
    settings::{Settings, Theme},
};
use std::path::PathBuf;
struct Operation {
    job: Job,
    status: String,
    error: bool,
}
enum Dialog {
    Import {
        identity: Identity,
        zip: bool,
        path: String,
        name: String,
    },
    Rename(Identity, String),
    Manual(Identity, String),
    Confirm {
        identity: Identity,
        action: Action,
        title: String,
        lines: Vec<String>,
    },
    Settings,
    SettingsImport(Settings),
}
pub struct Controls {
    pub confirm_rect: Option<egui::Rect>,
    pub import_rect: Option<egui::Rect>,
    previews: crate::preview::Previews,
    worker: Mutations,
    managed: PathBuf,
    trash: PathBuf,
    pub settings: Settings,
    settings_path: PathBuf,
    next: u64,
    operations: Vec<Operation>,
    dialog: Option<Dialog>,
    candidates: Option<(
        Identity,
        Vec<ts4_mod_manager_core::source_candidates::SourceCandidate>,
    )>,
    trash_entries: Option<(Identity, Vec<ts4_mod_manager_core::lifecycle::TrashEntry>)>,
    transfer_path: String,
    include_key: bool,
    pub error: Option<String>,
    pub refresh: Option<PathBuf>,
    pub roots_changed: Option<PathBuf>,
}
impl Controls {
    pub fn new(
        managed: PathBuf,
        home: PathBuf,
        settings: Settings,
        wake: impl Fn() + Send + 'static,
    ) -> std::io::Result<Self> {
        Ok(Self {
            confirm_rect: None,
            import_rect: None,
            previews: Default::default(),
            worker: Mutations::start(wake)?,
            managed,
            trash: home.join(".local/share/Trash/files"),
            settings,
            settings_path: home.join(".config/ts4-mod-manager/settings.json"),
            next: 1,
            operations: vec![],
            dialog: None,
            candidates: None,
            trash_entries: None,
            transfer_path: String::new(),
            include_key: false,
            error: None,
            refresh: None,
            roots_changed: None,
        })
    }
    fn identity(&mut self, catalog: &Catalog) -> Option<Identity> {
        let root = catalog.root.clone()?;
        let identity = Identity {
            operation: self.next,
            root,
            entry: catalog.selected.clone(),
            generation: catalog.generation(),
        };
        self.next += 1;
        Some(identity)
    }
    fn submit(&mut self, identity: Identity, action: Action) {
        let job = Job {
            identity,
            managed: self.managed.clone(),
            trash: self.trash.clone(),
            action,
        };
        match self.worker.submit(job.clone()) {
            Ok(()) => self.operations.push(Operation {
                job,
                status: "Queued".into(),
                error: false,
            }),
            Err(e) => self.error = Some(e),
        }
    }
    pub(crate) fn fixture_action(
        &mut self,
        root: PathBuf,
        entry: Option<crate::catalog::EntryId>,
        action: Action,
    ) -> Result<Output, String> {
        let mut catalog = Catalog::default();
        catalog.begin_scan(root);
        catalog.selected = entry;
        let identity = self.identity(&catalog).ok_or("Missing fixture root")?;
        let operation = identity.operation;
        self.submit(identity, action);
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(20);
        loop {
            for event in self.worker.drain() {
                match event {
                    Event::Running(identity) => {
                        if let Some(job) = self
                            .operations
                            .iter_mut()
                            .find(|job| job.job.identity.operation == identity.operation)
                        {
                            job.status = "Running".into();
                        }
                    }
                    Event::Finished(identity, result) if identity.operation == operation => {
                        if let Some(job) = self
                            .operations
                            .iter_mut()
                            .find(|job| job.job.identity.operation == operation)
                        {
                            job.status = "Finished".into();
                            job.error = result.is_err();
                        }
                        return result;
                    }
                    _ => {}
                }
            }
            if std::time::Instant::now() >= deadline {
                return Err("Fixture workflow timed out".into());
            }
            std::thread::sleep(std::time::Duration::from_millis(2));
        }
    }
    pub fn busy(&self) -> bool {
        self.operations
            .iter()
            .any(|o| o.status == "Queued" || o.status == "Running")
    }
    pub fn poll(&mut self, catalog: &Catalog) {
        for event in self.worker.drain().collect::<Vec<_>>() {
            match event {
                Event::Running(identity) => {
                    if let Some(op) = self
                        .operations
                        .iter_mut()
                        .find(|o| o.job.identity.operation == identity.operation)
                    {
                        op.status = "Running".into()
                    }
                }
                Event::Finished(identity, result) => {
                    let mut failure = None;
                    match result {
                        Err(e) => failure = Some(e),
                        Ok(Output::Changed(issues)) => {
                            if catalog.root.as_ref() == Some(&identity.root) {
                                self.refresh = Some(identity.root.clone())
                            }
                            if !issues.is_empty() {
                                failure = Some(issues.join("\n"))
                            }
                        }
                        Ok(Output::Review(review))
                            if identity.current(
                                catalog.root.as_ref(),
                                catalog.selected.as_ref(),
                                catalog.generation(),
                            ) =>
                        {
                            let enabled = self
                                .operations
                                .iter()
                                .find(|o| o.job.identity.operation == identity.operation)
                                .and_then(|o| match o.job.action {
                                    Action::ReviewToggle { enabled } => Some(enabled),
                                    _ => None,
                                })
                                .unwrap_or(false);
                            let mut lines = review
                                .operations
                                .iter()
                                .map(|o| {
                                    format!(
                                        "{}: {}{}",
                                        o.action,
                                        identity.root.join("Mods").join(&o.path).display(),
                                        o.reason
                                            .as_ref()
                                            .map(|r| format!("\n{r}"))
                                            .unwrap_or_default()
                                    )
                                })
                                .collect::<Vec<_>>();
                            lines.extend(review.issues.iter().map(|i| i.message.clone()));
                            if review.can_apply {
                                let token = serde_json::to_string(&review).expect("review JSON");
                                self.dialog = Some(Dialog::Confirm {
                                    identity: identity.clone(),
                                    action: Action::Toggle {
                                        enabled,
                                        review: token,
                                    },
                                    title: if enabled { "Enable mod" } else { "Disable mod" }
                                        .into(),
                                    lines,
                                });
                            } else {
                                failure = Some(lines.join("\n"))
                            }
                        }
                        Ok(Output::Candidates(candidates))
                            if identity.current(
                                catalog.root.as_ref(),
                                catalog.selected.as_ref(),
                                catalog.generation(),
                            ) =>
                        {
                            self.candidates = Some((identity.clone(), candidates));
                        }
                        Ok(Output::Trash(entries))
                            if identity.current(
                                catalog.root.as_ref(),
                                catalog.selected.as_ref(),
                                catalog.generation(),
                            ) =>
                        {
                            self.candidates = None;
                            self.dialog = None;
                            self.trash_entries = Some((identity.clone(), entries));
                        }
                        _ => {}
                    }
                    if let Some(op) = self
                        .operations
                        .iter_mut()
                        .find(|o| o.job.identity.operation == identity.operation)
                    {
                        op.error = failure.is_some();
                        op.status = failure.unwrap_or_else(|| "Finished".into());
                    }
                }
            }
        }
    }
    fn confirm(&mut self, catalog: &Catalog, action: Action, title: &str, lines: Vec<String>) {
        if let Some(identity) = self.identity(catalog) {
            self.dialog = Some(Dialog::Confirm {
                identity,
                action,
                title: title.into(),
                lines,
            })
        }
    }
    pub fn show(&mut self, ui: &mut egui::Ui, catalog: &Catalog) {
        if self.candidates.as_ref().is_some_and(|(id, _)| {
            !id.current(
                catalog.root.as_ref(),
                catalog.selected.as_ref(),
                catalog.generation(),
            )
        }) {
            self.candidates = None;
        }
        egui::Panel::bottom("management-controls")
            .frame(egui::Frame::new().fill(ui.visuals().panel_fill).inner_margin(egui::Margin::symmetric(24, 10)))
            .show(ui, |ui| {
                ui.horizontal_wrapped(|ui| {
                    let ready = catalog.root.is_some() && !catalog.loading;
                    let import = ui.add_enabled(
                        ready,
                        egui::Button::new("Import folder")
                            .fill(ui.visuals().selection.bg_fill)
                            .stroke(ui.visuals().selection.stroke),
                    );
                    self.import_rect = Some(import.rect);
                    if import.clicked()
                        && let Some(identity) = self.identity(catalog)
                    {
                        self.dialog = Some(Dialog::Import {
                            identity,
                            zip: false,
                            path: String::new(),
                            name: String::new(),
                        })
                    }
                    if ui.add_enabled(ready, egui::Button::new("Import ZIP")).clicked()
                        && let Some(identity) = self.identity(catalog)
                    {
                        self.dialog = Some(Dialog::Import {
                            identity,
                            zip: true,
                            path: String::new(),
                            name: String::new(),
                        })
                    }
                    if ui.add_enabled(ready, egui::Button::new("Restore from trash")).clicked()
                        && let Some(id) = self.identity(catalog)
                    {
                        self.submit(id, Action::ListTrash)
                    }
                    if ui.button("Settings").clicked() {
                        self.dialog = Some(Dialog::Settings)
                    }
                    if let Some(entry) = catalog.selected_mod().filter(|_| ready) {
                        if let Some(managed_id) = &entry.id {
                            if ui.button(if entry.enabled { "Disable" } else { "Enable" }).clicked()
                                && let Some(id) = self.identity(catalog)
                            {
                                self.submit(id, Action::ReviewToggle { enabled: !entry.enabled })
                            }
                            if ui.button("Rename").clicked()
                                && let Some(identity) = self.identity(catalog)
                            {
                                self.dialog = Some(Dialog::Rename(identity, entry.name.clone()))
                            }
                            if ui.button("Find source").clicked()
                                && let Some(id) = self.identity(catalog)
                            {
                                self.submit(id, Action::Lookup(self.settings.curseforge_api_key.clone()))
                            }
                            if ui.button("Attach URL").clicked()
                                && let Some(identity) = self.identity(catalog)
                            {
                                self.dialog = Some(Dialog::Manual(identity, String::new()))
                            }
                            if entry.source_url.is_some() && ui.button("Remove source").clicked() {
                                self.confirm(catalog, Action::RemoveSource, "Remove source", vec![entry.source_url.clone().unwrap()])
                            }
                            if ui.button("Move to trash").clicked() {
                                self.confirm(
                                    catalog,
                                    Action::Trash,
                                    "Move managed mod to trash",
                                    vec![
                                        self.managed.join("mods").join(managed_id).display().to_string(),
                                        "Verified installed links will be removed. Files stay recoverable in trash.".into(),
                                    ],
                                )
                            }
                        } else if ui.button("Manage external mod").clicked() {
                            self.confirm(
                                catalog,
                                Action::Migrate { files: entry.files.clone() },
                                "Review external migration",
                                entry
                                    .files
                                    .iter()
                                    .map(|f| catalog.root.as_ref().unwrap().join("Mods").join(f).display().to_string())
                                    .collect(),
                            )
                        }
                    }
                });
                if self.busy() {
                    ui.label("Approved operations will finish before the window closes.");
                }
                if let Some(error) = &self.error {
                    ui.colored_label(ui.visuals().error_fg_color, error);
                }
                let mut retry = None;
                egui::ScrollArea::vertical().max_height(90.0).show(ui, |ui| {
                    for operation in self.operations.iter().rev() {
                        ui.horizontal(|ui| {
                            ui.label(format!(
                                "#{} · {} · {} · {}",
                                operation.job.identity.operation,
                                operation.job.action.label(),
                                operation.job.identity.root.display(),
                                operation.status
                            ));
                            if operation.error && ui.button("Retry").clicked() {
                                retry = Some(operation.job.clone())
                            }
                        });
                    }
                });
                if let Some(mut job) = retry {
                    job.identity.operation = self.next;
                    self.next += 1;
                    match job.action {
                        Action::Toggle { enabled, .. } => self.submit(job.identity, Action::ReviewToggle { enabled }),
                        _ => self.submit(job.identity, job.action),
                    }
                }
            });
        self.dialogs(ui.ctx(), catalog);
    }
    fn dialogs(&mut self, ctx: &egui::Context, catalog: &Catalog) {
        self.confirm_rect = None;
        self.previews.begin_frame(ctx, catalog.generation());
        if let Some((identity, candidates)) = self.candidates.take() {
            let mut keep = true;
            egui::Window::new("Source candidates").default_width(480.0).show(ctx, |ui| {
                if candidates.is_empty() {
                    ui.label("No real provider candidates were found.");
                }
                egui::ScrollArea::vertical().max_height(350.0).show(ui, |ui| {
                    for candidate in &candidates {
                        ui.heading(&candidate.title);
                        ui.label(&candidate.source_url);
                        ui.label(format!("Confidence: {}%", candidate.confidence));
                        if candidate.confidence < 70 {
                            ui.colored_label(ui.visuals().error_fg_color, "Low confidence. Check this project carefully before attaching.");
                        }
                        for reason in &candidate.reasons {
                            ui.label(reason);
                        }
                        for evidence in &candidate.evidence {
                            ui.label(format!("{}: {}", evidence.kind, evidence.description));
                        }
                        if ui.button("Review attachment").clicked() {
                            let mut lines = vec![
                                candidate.title.clone(),
                                candidate.source_url.clone(),
                                format!("Confidence: {}%", candidate.confidence),
                            ];
                            if candidate.confidence < 70 {
                                lines.push("Low confidence: this candidate is not verified.".into());
                            }
                            lines.extend(candidate.reasons.clone());
                            lines.extend(candidate.evidence.iter().map(|e| e.description.clone()));
                            self.dialog = Some(Dialog::Confirm {
                                identity: identity.clone(),
                                action: Action::Attach(candidate.clone()),
                                title: "Attach source candidate".into(),
                                lines,
                            });
                            keep = false;
                        }
                        ui.separator();
                    }
                });
                if ui.button("Close").clicked() {
                    keep = false;
                }
            });
            if keep {
                self.candidates = Some((identity, candidates));
            }
        }
        if let Some((identity, entries)) = self.trash_entries.take().filter(|(id, _)| {
            id.current(
                catalog.root.as_ref(),
                catalog.selected.as_ref(),
                catalog.generation(),
            )
        }) {
            let mut keep = true;
            egui::Window::new("Restore from trash").show(ctx, |ui| {
                if entries.is_empty() {
                    ui.label("No recoverable entries in trash.");
                }
                egui::ScrollArea::vertical().max_height(300.0).show(ui, |ui| {
                    for entry in &entries {
                        ui.label(&entry.path);
                        if let Some(path) = &entry.original_path {
                            ui.label(format!("Original location: {path}"));
                        }
                        if ui.button(format!("Review restore: {}", entry.name)).clicked() {
                            self.confirm(
                                catalog,
                                Action::Restore(entry.name.clone()),
                                "Restore mod",
                                vec![entry.path.clone(), "Restore checks destinations and refuses to overwrite files.".into()],
                            );
                            keep = false;
                        }
                    }
                });
                if ui.button("Close").clicked() {
                    keep = false;
                }
            });
            if keep {
                self.trash_entries = Some((identity, entries));
            }
        }
        let Some(mut dialog) = self.dialog.take() else {
            return;
        };
        let mut keep = true;
        let title = match &dialog {
            Dialog::Import { zip, .. } => {
                if *zip {
                    "Import ZIP"
                } else {
                    "Import folder"
                }
            }
            Dialog::Rename(..) => "Rename mod",
            Dialog::Manual(..) => "Attach manual source URL",
            Dialog::Confirm { title, .. } => title,
            Dialog::Settings => "Local settings",
            Dialog::SettingsImport(_) => "Review imported settings",
        }
        .to_string();
        egui::Window::new(title)
            .default_width(480.0)
            .collapsible(false)
            .show(ctx, |ui| {
                match &mut dialog {
                    Dialog::Import {
                        identity,
                        zip,
                        path,
                        name,
                    } => {
                        ui.label(if *zip { "ZIP path" } else { "Folder path" });
                        ui.text_edit_singleline(path);
                        ui.label("Mod name");
                        ui.text_edit_singleline(name);
                        if ui
                            .add_enabled(
                                identity.current(
                                    catalog.root.as_ref(),
                                    catalog.selected.as_ref(),
                                    catalog.generation(),
                                ) && !path.trim().is_empty()
                                    && !name.trim().is_empty(),
                                egui::Button::new("Import"),
                            )
                            .clicked()
                        {
                            {
                                self.submit(
                                    identity.clone(),
                                    if *zip {
                                        Action::ImportZip {
                                            path: path.trim().into(),
                                            name: name.trim().into(),
                                        }
                                    } else {
                                        Action::ImportFolder {
                                            path: path.trim().into(),
                                            name: name.trim().into(),
                                        }
                                    },
                                );
                                keep = false;
                            }
                        }
                    }
                    Dialog::Rename(identity, name) => {
                        ui.label("Display name");
                        ui.text_edit_singleline(name);
                        if ui
                            .add_enabled(
                                identity.current(
                                    catalog.root.as_ref(),
                                    catalog.selected.as_ref(),
                                    catalog.generation(),
                                ) && !name.trim().is_empty(),
                                egui::Button::new("Save name"),
                            )
                            .clicked()
                        {
                            self.submit(identity.clone(), Action::Rename(name.clone()));
                            keep = false;
                        }
                    }
                    Dialog::Manual(identity, url) => {
                        ui.label("Source URL. Manual attachments carry no verified match claim.");
                        ui.text_edit_singleline(url);
                        if ui
                            .add_enabled(
                                identity.current(
                                    catalog.root.as_ref(),
                                    catalog.selected.as_ref(),
                                    catalog.generation(),
                                ) && !url.trim().is_empty(),
                                egui::Button::new("Review URL attachment"),
                            )
                            .clicked()
                        {
                            self.confirm(
                                catalog,
                                Action::ManualSource(url.trim().into()),
                                "Attach manual source URL",
                                vec![
                                    url.trim().into(),
                                    "Save this URL to the selected mod's metadata?".into(),
                                ],
                            );
                            keep = false;
                        }
                    }
                    Dialog::Confirm {
                        identity,
                        action,
                        lines,
                        ..
                    } => {
                        egui::ScrollArea::vertical()
                            .max_height(350.0)
                            .show(ui, |ui| {
                                for line in lines {
                                    ui.label(line.as_str());
                                }
                            });
                        let current = identity.current(
                            catalog.root.as_ref(),
                            catalog.selected.as_ref(),
                            catalog.generation(),
                        );
                        if !current {
                            ui.colored_label(
                                ui.visuals().error_fg_color,
                                "Selection or catalog changed. Close and review again.",
                            );
                        }
                        let confirm = ui.add_enabled(current, egui::Button::new("Confirm"));
                        if current {
                            self.confirm_rect = Some(confirm.rect);
                        }
                        if confirm.clicked() {
                            let mut identity = identity.clone();
                            identity.operation = self.next;
                            self.next += 1;
                            self.submit(identity, action.clone());
                            keep = false;
                        }
                    }
                    Dialog::Settings => {
                        ui.label("Theme");
                        ui.horizontal(|ui| {
                            ui.selectable_value(&mut self.settings.theme, Theme::Light, "Light");
                            ui.selectable_value(&mut self.settings.theme, Theme::Dark, "Dark");
                            ui.selectable_value(&mut self.settings.theme, Theme::System, "System");
                        });
                        ui.label("CurseForge API key stored only in local settings");
                        let key = self
                            .settings
                            .curseforge_api_key
                            .get_or_insert_with(String::new);
                        ui.add(egui::TextEdit::singleline(key).password(true));
                        ui.label("Saved game folders");
                        for root in &self.settings.game_roots {
                            ui.label(root);
                        }
                        if let Some(root) = &catalog.root
                            && ui.button("Remember current folder").clicked()
                        {
                            let path = root.to_string_lossy().into_owned();
                            if !self.settings.game_roots.contains(&path) {
                                self.settings.game_roots.push(path.clone());
                            }
                            self.settings.selected_root = Some(path);
                        }
                        if ui.button("Save local settings").clicked() {
                            match self.settings.save(&self.settings_path) {
                                Ok(()) => {
                                    ctx.set_theme(match self.settings.theme {
                                        Theme::Light => egui::ThemePreference::Light,
                                        Theme::Dark => egui::ThemePreference::Dark,
                                        Theme::System => egui::ThemePreference::System,
                                    });
                                    keep = false;
                                }
                                Err(e) => self.error = Some(e),
                            }
                        }
                        ui.separator();
                        ui.label("Transfer JSON path");
                        ui.text_edit_singleline(&mut self.transfer_path);
                        ui.checkbox(&mut self.include_key, "Include API key in export");
                        if ui
                            .add_enabled(
                                !self.transfer_path.trim().is_empty(),
                                egui::Button::new("Export settings"),
                            )
                            .clicked()
                        {
                            let mut exported = self.settings.clone();
                            if !self.include_key {
                                exported.curseforge_api_key = None;
                            }
                            match exported.save(&PathBuf::from(self.transfer_path.trim())) {
                                Ok(()) => self.error = Some("Settings exported".into()),
                                Err(e) => self.error = Some(e),
                            }
                        }
                        if ui
                            .add_enabled(
                                !self.transfer_path.trim().is_empty(),
                                egui::Button::new("Preview settings import"),
                            )
                            .clicked()
                        {
                            let result = std::fs::read_to_string(self.transfer_path.trim())
                                .map_err(|_| "Cannot read settings transfer".to_string())
                                .and_then(|raw| Settings::parse(&raw));
                            match result {
                                Ok(settings) => {
                                    self.dialog = Some(Dialog::SettingsImport(settings));
                                    keep = false;
                                }
                                Err(e) => self.error = Some(e),
                            }
                        }
                    }
                    Dialog::SettingsImport(settings) => {
                        ui.label("Version 1 settings");
                        ui.label(format!(
                            "Theme: {}",
                            match settings.theme {
                                Theme::Light => "light",
                                Theme::Dark => "dark",
                                Theme::System => "system",
                            }
                        ));
                        for root in &settings.game_roots {
                            ui.label(root);
                        }
                        if let Some(selected) = &settings.selected_root {
                            ui.label(format!("Selected folder: {selected}"));
                        }
                        ui.label(if settings.curseforge_api_key.is_some() {
                            "Includes an API key"
                        } else {
                            "Does not include an API key"
                        });
                        if ui.button("Confirm settings import").clicked() {
                            match settings.save(&self.settings_path) {
                                Ok(()) => {
                                    self.settings = settings.clone();
                                    ctx.set_theme(match settings.theme {
                                        Theme::Light => egui::ThemePreference::Light,
                                        Theme::Dark => egui::ThemePreference::Dark,
                                        Theme::System => egui::ThemePreference::System,
                                    });
                                    self.roots_changed =
                                        settings.selected_root.as_ref().map(PathBuf::from);
                                    keep = false;
                                }
                                Err(e) => self.error = Some(e),
                            }
                        }
                    }
                }
                if ui.button("Cancel").clicked() {
                    keep = false;
                }
            });
        if keep {
            self.dialog = Some(dialog);
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    fn frame(
        ctx: &egui::Context,
        controls: &mut Controls,
        catalog: &Catalog,
        events: Vec<egui::Event>,
    ) {
        let mut output = ctx.run_ui(
            egui::RawInput {
                screen_rect: Some(egui::Rect::from_min_size(
                    egui::Pos2::ZERO,
                    egui::vec2(1100.0, 800.0),
                )),
                events,
                ..Default::default()
            },
            |ui| {
                controls.show(ui, catalog);
            },
        );
        output.textures_delta.clear();
    }
    #[test]
    fn dialog_confirm_click_enqueues_and_stale_selection_cannot_confirm() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("game");
        std::fs::create_dir_all(root.join("Mods")).unwrap();
        let mut catalog = Catalog::default();
        catalog.begin_scan(root.clone());
        let mut controls = Controls::new(
            dir.path().join("managed"),
            dir.path().to_path_buf(),
            Settings::default(),
            || {},
        )
        .unwrap();
        controls.confirm(
            &catalog,
            Action::RemoveSource,
            "Remove source",
            vec!["fixture".into()],
        );
        let ctx = egui::Context::default();
        frame(&ctx, &mut controls, &catalog, vec![]);
        frame(&ctx, &mut controls, &catalog, vec![]);
        let pos = controls.confirm_rect.unwrap().center();
        frame(
            &ctx,
            &mut controls,
            &catalog,
            vec![
                egui::Event::PointerMoved(pos),
                egui::Event::PointerButton {
                    pos,
                    button: egui::PointerButton::Primary,
                    pressed: true,
                    modifiers: Default::default(),
                },
                egui::Event::PointerButton {
                    pos,
                    button: egui::PointerButton::Primary,
                    pressed: false,
                    modifiers: Default::default(),
                },
            ],
        );
        assert_eq!(controls.operations.len(), 1);
        controls.confirm(&catalog, Action::RemoveSource, "Remove source", vec![]);
        catalog.begin_scan(dir.path().join("other"));
        frame(&ctx, &mut controls, &catalog, vec![]);
        assert!(controls.confirm_rect.is_none());
        assert_eq!(controls.operations.len(), 1);
    }
    #[test]
    fn toolbar_pointer_opens_import_without_submitting_unapproved_job() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("game");
        let mut catalog = Catalog::default();
        let generation = catalog.begin_scan(root);
        catalog.accept_scan(generation, Ok(vec![]));
        let mut controls = Controls::new(
            dir.path().join("managed"),
            dir.path().to_path_buf(),
            Settings::default(),
            || {},
        )
        .unwrap();
        let ctx = egui::Context::default();
        frame(&ctx, &mut controls, &catalog, vec![]);
        frame(&ctx, &mut controls, &catalog, vec![]);
        let pos = controls.import_rect.unwrap().center();
        frame(
            &ctx,
            &mut controls,
            &catalog,
            vec![
                egui::Event::PointerMoved(pos),
                egui::Event::PointerButton {
                    pos,
                    button: egui::PointerButton::Primary,
                    pressed: true,
                    modifiers: Default::default(),
                },
                egui::Event::PointerButton {
                    pos,
                    button: egui::PointerButton::Primary,
                    pressed: false,
                    modifiers: Default::default(),
                },
            ],
        );
        assert!(matches!(controls.dialog, Some(Dialog::Import { .. })));
        assert!(controls.operations.is_empty());
    }
    #[test]
    fn late_failed_review_keeps_its_history_identity_without_replacing_new_selection() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("old");
        std::fs::create_dir_all(root.join("Mods")).unwrap();
        let mut catalog = Catalog::default();
        catalog.begin_scan(root.clone());
        catalog.selected = Some(crate::catalog::EntryId::Managed("missing".into()));
        let mut controls = Controls::new(
            dir.path().join("managed"),
            dir.path().to_path_buf(),
            Settings::default(),
            || {},
        )
        .unwrap();
        let identity = controls.identity(&catalog).unwrap();
        controls.submit(identity.clone(), Action::ReviewToggle { enabled: true });
        catalog.begin_scan(dir.path().join("new"));
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(5);
        while controls.busy() {
            controls.poll(&catalog);
            assert!(std::time::Instant::now() < deadline);
            std::thread::sleep(std::time::Duration::from_millis(2));
        }
        assert!(controls.dialog.is_none());
        assert!(controls.candidates.is_none());
        assert!(controls.refresh.is_none());
        assert!(catalog.error.is_none());
        assert!(controls.operations[0].error);
        assert_eq!(controls.operations[0].job.identity, identity);
    }
}
