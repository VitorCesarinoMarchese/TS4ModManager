use std::collections::BTreeSet;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FingerprintFile {
    pub relative_path: String,
    pub size: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ModFingerprint {
    pub display_name: String,
    pub folder_name: Option<String>,
    pub normalized_name: String,
    pub relative_paths: Vec<String>,
    pub basenames: Vec<String>,
    pub extensions: Vec<String>,
    pub file_sizes: Vec<u64>,
    pub package_script_basenames: Vec<String>,
    pub version_tokens: Vec<String>,
    pub archive_name: Option<String>,
    pub existing_source_url: Option<String>,
}

pub fn build_mod_fingerprint(
    display_name: &str,
    folder_name: Option<&str>,
    files: &[FingerprintFile],
    archive_name: Option<&str>,
    existing_source_url: Option<&str>,
) -> ModFingerprint {
    let useful_files = files
        .iter()
        .filter(|file| is_useful_source_evidence(&file.relative_path))
        .collect::<Vec<_>>();

    let relative_paths = useful_files.iter().map(|file| file.relative_path.clone()).collect::<Vec<_>>();
    let basenames = useful_files.iter().filter_map(|file| basename(&file.relative_path)).collect::<BTreeSet<_>>();
    let extensions = useful_files.iter().filter_map(|file| extension(&file.relative_path)).collect::<BTreeSet<_>>();
    let package_script_basenames = useful_files
        .iter()
        .filter(|file| {
            let ext = extension(&file.relative_path).unwrap_or_default();
            ext == "package" || ext == "ts4script"
        })
        .filter_map(|file| basename_without_extension(&file.relative_path))
        .collect::<BTreeSet<_>>();

    let mut token_sources = vec![display_name.to_string()];
    if let Some(folder) = folder_name {
        token_sources.push(folder.to_string());
    }
    if let Some(archive) = archive_name {
        token_sources.push(archive.to_string());
    }
    token_sources.extend(relative_paths.iter().cloned());

    let version_tokens = token_sources
        .iter()
        .flat_map(|source| extract_version_tokens(source))
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect::<Vec<_>>();

    ModFingerprint {
        display_name: display_name.trim().to_string(),
        folder_name: folder_name.map(|name| name.trim().to_string()).filter(|name| !name.is_empty()),
        normalized_name: normalize_name(folder_name.unwrap_or(display_name)),
        relative_paths,
        basenames: basenames.into_iter().collect(),
        extensions: extensions.into_iter().collect(),
        file_sizes: useful_files.iter().map(|file| file.size).collect(),
        package_script_basenames: package_script_basenames.into_iter().collect(),
        version_tokens,
        archive_name: archive_name.map(|name| name.trim().to_string()).filter(|name| !name.is_empty()),
        existing_source_url: existing_source_url.map(|url| url.trim().to_string()).filter(|url| !url.is_empty()),
    }
}

pub fn is_useful_source_evidence(path: &str) -> bool {
    let lower = path.to_lowercase();
    let Some(base) = lower.rsplit('/').next() else { return false; };
    if base == "meta.json" || base.ends_with(".log") || base.ends_with(".tmp") {
        return false;
    }
    let ignored_extensions = ["png", "jpg", "jpeg", "gif", "webp", "bmp"];
    if let Some(ext) = extension(base) {
        !ignored_extensions.contains(&ext.as_str())
    } else {
        true
    }
}

pub fn normalize_name(raw: &str) -> String {
    let without_versions = split_word_boundaries(&strip_version_tokens(raw));
    without_versions
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() { ch.to_ascii_lowercase() } else { ' ' })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn split_word_boundaries(raw: &str) -> String {
    let chars = raw.chars().collect::<Vec<_>>();
    let mut out = String::new();
    for (index, ch) in chars.iter().enumerate() {
        let previous = index.checked_sub(1).and_then(|previous| chars.get(previous));
        let next = chars.get(index + 1);
        let starts_new_word = ch.is_ascii_uppercase()
            && previous.is_some_and(|previous| previous.is_ascii_lowercase() || previous.is_ascii_digit())
            || ch.is_ascii_uppercase()
                && previous.is_some_and(|previous| previous.is_ascii_uppercase())
                && next.is_some_and(|next| next.is_ascii_lowercase());
        if starts_new_word {
            out.push(' ');
        }
        out.push(*ch);
    }
    out
}

pub fn extract_version_tokens(raw: &str) -> Vec<String> {
    version_token_ranges(raw)
        .into_iter()
        .filter_map(|(start, end)| {
            let token = raw[start..end].trim_matches(|ch: char| ch == '_' || ch == '.');
            looks_like_version_token(token).then(|| token.replace('_', "."))
        })
        .collect()
}

fn strip_version_tokens(raw: &str) -> String {
    let mut output = raw.to_string();
    for (start, end) in version_token_ranges(raw).into_iter().rev() {
        output.replace_range(start..end, " ");
    }
    output
}

fn version_token_ranges(raw: &str) -> Vec<(usize, usize)> {
    let chars = raw.char_indices().collect::<Vec<_>>();
    let mut ranges = vec![];
    let mut i = 0;
    while i < chars.len() {
        let (start, ch) = chars[i];
        let starts_version = ch.is_ascii_digit()
            || ((ch == 'v' || ch == 'V') && chars.get(i + 1).is_some_and(|(_, next)| next.is_ascii_digit()));
        if !starts_version {
            i += 1;
            continue;
        }

        let mut j = i + 1;
        while j < chars.len() {
            let (_, next) = chars[j];
            if next.is_ascii_digit() || next == '_' || next == '.' {
                j += 1;
            } else {
                break;
            }
        }
        let end = chars.get(j).map(|(idx, _)| *idx).unwrap_or(raw.len());
        let token = raw[start..end].trim_matches(|candidate| candidate == '_' || candidate == '.');
        if looks_like_version_token(token) {
            ranges.push((start, end));
            i = j;
        } else {
            i += 1;
        }
    }
    ranges
}

fn looks_like_version_token(token: &str) -> bool {
    let token = token.trim_start_matches(['v', 'V']);
    let parts = token.split(['_', '.']).collect::<Vec<_>>();
    if parts.len() < 2 || parts.len() > 4 {
        return false;
    }
    parts.iter().all(|part| !part.is_empty() && part.chars().all(|ch| ch.is_ascii_digit()))
}

fn basename(path: &str) -> Option<String> {
    path.rsplit('/').next().map(ToString::to_string).filter(|name| !name.is_empty())
}

fn basename_without_extension(path: &str) -> Option<String> {
    let base = basename(path)?;
    let stem = base.rsplit_once('.').map(|(stem, _)| stem).unwrap_or(&base);
    Some(stem.to_string()).filter(|name| !name.is_empty())
}

fn extension(path: &str) -> Option<String> {
    path.rsplit('/').next()?.rsplit_once('.').map(|(_, ext)| ext.to_lowercase()).filter(|ext| !ext.is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_versions_from_common_sims_names() {
        assert_eq!(extract_version_tokens("McCmdCenter_AllModules_2026_2_0"), vec!["2026.2.0"]);
        assert_eq!(extract_version_tokens("coolmod-v1.2.3.zip"), vec!["v1.2.3"]);
        assert_eq!(extract_version_tokens("Patch 1.110.package"), vec!["1.110"]);
    }

    #[test]
    fn normalizes_camel_case_mod_names() {
        assert_eq!(normalize_name("McCmdCenter_AllModules_2026_2_0"), "mc cmd center all modules");
        assert_eq!(normalize_name("WonderfulWhims.package"), "wonderful whims package");
    }

    #[test]
    fn ignores_images_logs_and_app_metadata() {
        assert!(!is_useful_source_evidence("Pack/cover.jpg"));
        assert!(!is_useful_source_evidence("Pack/preview.png"));
        assert!(!is_useful_source_evidence("Pack/mc_cmd_center.log"));
        assert!(!is_useful_source_evidence("meta.json"));
        assert!(is_useful_source_evidence("Pack/mc_cmd_center.package"));
        assert!(is_useful_source_evidence("Pack/mc_cmd_center.ts4script"));
    }

    #[test]
    fn builds_fingerprint_from_grouped_mod_files() {
        let fingerprint = build_mod_fingerprint(
            "Mc Command Center",
            Some("McCmdCenter_AllModules_2026_2_0"),
            &[
                FingerprintFile { relative_path: "McCmdCenter_AllModules_2026_2_0/mc_cmd_center.package".to_string(), size: 11 },
                FingerprintFile { relative_path: "McCmdCenter_AllModules_2026_2_0/mc_career.ts4script".to_string(), size: 22 },
                FingerprintFile { relative_path: "McCmdCenter_AllModules_2026_2_0/cover.jpg".to_string(), size: 33 },
                FingerprintFile { relative_path: "McCmdCenter_AllModules_2026_2_0/mc_cmd_center.log".to_string(), size: 44 },
            ],
            Some("McCmdCenter_AllModules_2026_2_0.zip"),
            Some("https://www.curseforge.com/sims4/mods/mc-command-center"),
        );

        assert_eq!(fingerprint.normalized_name, "mc cmd center all modules");
        assert_eq!(fingerprint.relative_paths.len(), 2);
        assert_eq!(fingerprint.extensions, vec!["package", "ts4script"]);
        assert_eq!(fingerprint.package_script_basenames, vec!["mc_career", "mc_cmd_center"]);
        assert_eq!(fingerprint.version_tokens, vec!["2026.2.0"]);
        assert_eq!(fingerprint.archive_name.as_deref(), Some("McCmdCenter_AllModules_2026_2_0.zip"));
    }

    #[test]
    fn handles_loose_package_and_script_files() {
        let fingerprint = build_mod_fingerprint(
            "Loose Mod",
            None,
            &[
                FingerprintFile { relative_path: "loose_mod.package".to_string(), size: 100 },
                FingerprintFile { relative_path: "loose_mod.ts4script".to_string(), size: 200 },
            ],
            None,
            None,
        );

        assert_eq!(fingerprint.normalized_name, "loose mod");
        assert_eq!(fingerprint.file_sizes, vec![100, 200]);
        assert_eq!(fingerprint.package_script_basenames, vec!["loose_mod"]);
    }
}
