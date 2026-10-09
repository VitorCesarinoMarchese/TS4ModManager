use serde::{Deserialize, Serialize};
use std::{io::Write, path::Path};
#[derive(Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    Light,
    Dark,
    System,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Settings {
    pub version: u32,
    pub theme: Theme,
    pub game_roots: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub selected_root: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub curseforge_api_key: Option<String>,
}
impl Default for Settings {
    fn default() -> Self {
        Self {
            version: 1,
            theme: Theme::System,
            game_roots: vec![],
            selected_root: None,
            curseforge_api_key: None,
        }
    }
}
impl Settings {
    pub fn parse(raw: &str) -> Result<Self, String> {
        let mut value: Self =
            serde_json::from_str(raw).map_err(|_| "Invalid settings JSON or schema".to_string())?;
        if value.version != 1 {
            return Err("Settings require version 1".into());
        }
        let mut roots = Vec::new();
        for root in &value.game_roots {
            let normalized = normalize_root(root)?;
            if !roots.contains(&normalized) {
                roots.push(normalized);
            }
        }
        value.game_roots = roots;
        value.selected_root = value
            .selected_root
            .as_deref()
            .map(normalize_root)
            .transpose()?;
        if value
            .selected_root
            .as_ref()
            .is_some_and(|root| !value.game_roots.contains(root))
        {
            return Err("Selected root must appear in gameRoots".into());
        }
        Ok(value)
    }
    pub fn load(path: &Path) -> Result<Self, String> {
        if !path.exists() {
            return Ok(Self::default());
        }
        Self::parse(
            &std::fs::read_to_string(path).map_err(|_| "Cannot read local settings".to_string())?,
        )
    }
    pub fn export(&self, include_key: bool) -> Result<String, String> {
        let mut copy = self.clone();
        if !include_key {
            copy.curseforge_api_key = None;
        }
        serde_json::to_string_pretty(&copy).map_err(|_| "Cannot serialize settings".into())
    }
    pub fn save(&self, path: &Path) -> Result<(), String> {
        let parent = path.parent().ok_or("Settings path has no parent")?;
        std::fs::create_dir_all(parent).map_err(|_| "Cannot create settings directory")?;
        let mut temp =
            tempfile::NamedTempFile::new_in(parent).map_err(|_| "Cannot stage settings")?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            temp.as_file()
                .set_permissions(std::fs::Permissions::from_mode(0o600))
                .map_err(|_| "Cannot restrict settings permissions")?;
        }
        temp.write_all(self.export(true)?.as_bytes())
            .map_err(|_| "Cannot write settings")?;
        temp.as_file()
            .sync_all()
            .map_err(|_| "Cannot sync settings")?;
        temp.persist(path).map_err(|_| "Cannot publish settings")?;
        std::fs::File::open(parent)
            .and_then(|f| f.sync_all())
            .map_err(|_| "Cannot sync settings directory")?;
        Ok(())
    }
}

fn normalize_root(root: &str) -> Result<String, String> {
    let path = Path::new(root.trim());
    if !path.is_absolute() {
        return Err("Game folders must be nonempty absolute paths".into());
    }
    let mut normalized = std::path::PathBuf::new();
    for component in path.components() {
        match component {
            std::path::Component::CurDir => {}
            std::path::Component::ParentDir => {
                normalized.pop();
            }
            component => normalized.push(component.as_os_str()),
        }
    }
    Ok(normalized.to_string_lossy().into_owned())
}
