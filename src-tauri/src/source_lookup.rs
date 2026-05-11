use std::fs;
use std::path::Path;

use crate::error::{ErrorCode, ManagerError};
use crate::mod_scan::scan_mods;
use crate::source_candidates::{SourceCandidate, SourceProviderId};
use crate::source_fingerprint::{build_mod_fingerprint, FingerprintFile, ModFingerprint};
use crate::source_scoring::{evidence, score_candidate, CandidateScoreInput};

pub fn find_source_candidates_fixture(
    managed_root: &Path,
    game_mods_dir: &Path,
    mod_id: &str,
) -> Result<Vec<SourceCandidate>, ManagerError> {
    let scanned = scan_mods(game_mods_dir, managed_root);
    let selected = scanned
        .iter()
        .find(|mod_entry| mod_entry.id.as_deref() == Some(mod_id) || mod_entry.key == mod_id || mod_entry.name == mod_id)
        .ok_or_else(|| ManagerError::new(ErrorCode::NotFound, format!("Mod not found for source lookup: {mod_id}")))?;

    let files = selected
        .files
        .iter()
        .map(|relative| FingerprintFile {
            relative_path: relative.clone(),
            size: fs::metadata(game_mods_dir.join(relative)).map(|meta| meta.len()).unwrap_or(0),
        })
        .collect::<Vec<_>>();
    let folder_name = selected.group_path.first().map(String::as_str);
    let fingerprint = build_mod_fingerprint(&selected.name, folder_name, &files, None, selected.source_url.as_deref());

    Ok(fixture_provider_candidates(&fingerprint))
}

pub fn fixture_provider_candidates(fingerprint: &ModFingerprint) -> Vec<SourceCandidate> {
    let joined = format!(
        "{} {} {}",
        fingerprint.normalized_name,
        fingerprint.package_script_basenames.join(" "),
        fingerprint.archive_name.as_deref().unwrap_or_default()
    )
    .to_lowercase();

    if !(joined.contains("mccmdcenter") || joined.contains("mc command") || joined.contains("mc_cmd_center")) {
        return vec![];
    }

    let mut evidence_items = vec![
        evidence("fileName", "Matched MC Command Center package/script basename", 25),
        evidence("title", "Title/name similarity", 20),
        evidence("slug", "Slug similarity", 10),
    ];
    if fingerprint.version_tokens.iter().any(|token| token == "2026.2.0") {
        evidence_items.push(evidence("version", "Version token match: 2026.2.0", 20));
    }

    let Some(score) = score_candidate(CandidateScoreInput {
        evidence: evidence_items.clone(),
        has_file_metadata: true,
        has_file_evidence: true,
        name_only: false,
        fingerprint_match: false,
    }) else {
        return vec![];
    };

    vec![SourceCandidate {
        provider_id: SourceProviderId::Curseforge,
        title: "MC Command Center".to_string(),
        source_url: "https://www.curseforge.com/sims4/mods/mc-command-center".to_string(),
        preview_url: Some("https://media.forgecdn.net/avatars/mccc.png".to_string()),
        author: Some("Deaderpool".to_string()),
        project_id: Some(551680),
        file_id: None,
        confidence: score.confidence,
        confidence_level: score.confidence_level,
        reasons: score.reasons,
        evidence: evidence_items,
    }]
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::source_candidates::ConfidenceLevel;
    use tempfile::TempDir;

    #[test]
    fn fixture_provider_returns_candidate_from_file_evidence() {
        let fingerprint = build_mod_fingerprint(
            "Mc Command Center",
            Some("McCmdCenter_AllModules_2026_2_0"),
            &[FingerprintFile { relative_path: "McCmdCenter_AllModules_2026_2_0/mc_cmd_center.package".to_string(), size: 10 }],
            None,
            None,
        );

        let candidates = fixture_provider_candidates(&fingerprint);
        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].provider_id, SourceProviderId::Curseforge);
        assert_eq!(candidates[0].confidence_level, ConfidenceLevel::Medium);
        assert!(candidates[0].reasons.iter().any(|reason| reason.contains("package/script")));
    }

    #[test]
    fn fixture_provider_returns_empty_for_unrelated_mod() {
        let fingerprint = build_mod_fingerprint(
            "Random Trait",
            Some("RandomTrait"),
            &[FingerprintFile { relative_path: "RandomTrait/random_trait.package".to_string(), size: 10 }],
            None,
            None,
        );

        assert!(fixture_provider_candidates(&fingerprint).is_empty());
    }

    #[test]
    fn command_extracts_fingerprint_without_mutating_files() {
        let tmp = TempDir::new().expect("tmp");
        let managed = tmp.path().join("managed");
        let mods = tmp.path().join("Mods");
        fs::create_dir_all(mods.join("McCmdCenter_AllModules_2026_2_0")).expect("dirs");
        let package = mods.join("McCmdCenter_AllModules_2026_2_0/mc_cmd_center.package");
        fs::write(&package, b"pkg").expect("pkg");

        let before = fs::metadata(&package).expect("before").len();
        let candidates = find_source_candidates_fixture(&managed, &mods, "McCmdCenter_AllModules_2026_2_0").expect("lookup");
        let after = fs::metadata(&package).expect("after").len();

        assert_eq!(before, after);
        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].title, "MC Command Center");
    }
}
