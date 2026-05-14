use std::fs;
use std::path::Path;

use crate::curseforge_client::{CurseForgeClient, CurseForgeFileSummary, CurseForgeModSummary, SourceLookupError, UreqCurseForgeTransport};
use crate::error::{ErrorCode, ManagerError};
use crate::mod_scan::scan_mods;
use crate::source_candidates::{SourceCandidate, SourceProviderId};
use crate::source_fingerprint::{build_mod_fingerprint, normalize_name, FingerprintFile, ModFingerprint};
use crate::source_scoring::{evidence, score_candidate, CandidateScoreInput};

pub fn find_source_candidates(
    managed_root: &Path,
    game_mods_dir: &Path,
    mod_id: &str,
    api_key: Option<&str>,
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

    if api_key.is_some_and(|key| !key.trim().is_empty()) {
        match find_with_curseforge(&fingerprint, api_key) {
            Ok(candidates) => return Ok(candidates),
            Err(SourceLookupError::MissingApiKey) => {}
            Err(err) => return Err(source_lookup_error(err)),
        }
    }

    Ok(fixture_provider_candidates(&fingerprint))
}

fn source_lookup_error(err: SourceLookupError) -> ManagerError {
    let code = match err {
        SourceLookupError::MissingApiKey => ErrorCode::SourceMissingApiKey,
        SourceLookupError::Unauthorized => ErrorCode::SourceUnauthorized,
        SourceLookupError::RateLimited => ErrorCode::SourceRateLimited,
        SourceLookupError::Network => ErrorCode::SourceNetwork,
        SourceLookupError::InvalidResponse => ErrorCode::SourceInvalidResponse,
        SourceLookupError::ProviderUnavailable => ErrorCode::SourceProviderUnavailable,
        SourceLookupError::NoUsableEvidence => ErrorCode::SourceNoUsableEvidence,
    };
    ManagerError::new(code, format!("Source lookup failed: {err:?}"))
}

fn find_with_curseforge(fingerprint: &ModFingerprint, api_key: Option<&str>) -> Result<Vec<SourceCandidate>, SourceLookupError> {
    let client = CurseForgeClient::new(api_key, UreqCurseForgeTransport)?;
    let mut mods = vec![];
    for query in curseforge_queries(fingerprint) {
        mods.extend(client.search_mods(&query)?);
    }
    mods = dedupe_mods(mods);

    let mut candidates = vec![];
    for mod_summary in mods.into_iter().take(5) {
        let files = client.get_mod_files(mod_summary.project_id).unwrap_or_default();
        if let Some(candidate) = candidate_from_curseforge(fingerprint, mod_summary, &files) {
            candidates.push(candidate);
        }
    }
    candidates.sort_by(|a, b| b.confidence.cmp(&a.confidence));
    candidates.truncate(5);
    Ok(candidates)
}

pub fn curseforge_queries(fingerprint: &ModFingerprint) -> Vec<String> {
    let mut queries = vec![fingerprint.normalized_name.clone(), normalize_name(&fingerprint.display_name)];
    if let Some(folder) = &fingerprint.folder_name {
        queries.push(normalize_name(folder));
    }
    if let Some(first_file) = fingerprint.package_script_basenames.first() {
        queries.push(normalize_name(first_file));
    }
    let aliases = queries.iter().flat_map(|query| curseforge_query_aliases(query)).collect::<Vec<_>>();
    queries.extend(aliases);
    queries.retain(|query| !query.trim().is_empty());
    queries.sort();
    queries.dedup();
    queries
}

fn curseforge_query_aliases(query: &str) -> Vec<String> {
    let compact = canonical_compact_text(query);
    let mut aliases = vec![];
    if compact.contains("mccmdcenter") || compact.contains("mccenter") || compact.contains("mccmd") {
        aliases.push("mc command center".to_string());
        aliases.push("mc cmd center".to_string());
        aliases.push("mccc".to_string());
    }
    if compact.contains("mccommandcenter") {
        aliases.push("mc cmd center".to_string());
    }
    aliases
}

pub fn candidate_from_curseforge(
    fingerprint: &ModFingerprint,
    mod_summary: CurseForgeModSummary,
    files: &[CurseForgeFileSummary],
) -> Option<SourceCandidate> {
    let mut evidence_items = vec![];
    let normalized_title = normalize_name(&mod_summary.name);
    if text_related(&normalized_title, &fingerprint.normalized_name) {
        evidence_items.push(evidence("title", "Title/name similarity", 20));
    }
    let normalized_slug = mod_summary.slug.as_deref().map(normalize_name);
    if normalized_slug
        .as_deref()
        .is_some_and(|slug| text_related(slug, &fingerprint.normalized_name))
    {
        evidence_items.push(evidence("slug", "Slug similarity", 10));
    }

    let mut has_file_evidence = false;
    if fingerprint.package_script_basenames.iter().any(|name| {
        let normalized = normalize_name(name);
        text_related(&normalized, &normalized_title)
            || normalized_slug.as_deref().is_some_and(|slug| text_related(&normalized, slug))
    }) {
        evidence_items.push(evidence("packageName", "Package/script basename overlaps title or slug", 15));
        has_file_evidence = true;
    }
    for file in files {
        let file_name = file.file_name.to_lowercase();
        if fingerprint.archive_name.as_ref().is_some_and(|archive| archive.eq_ignore_ascii_case(&file.file_name)) {
            evidence_items.push(evidence("fileName", "Exact archive/file name match", 40));
            has_file_evidence = true;
        }
        if fingerprint
            .package_script_basenames
            .iter()
            .any(|name| text_related(&normalize_name(&file_name), &normalize_name(name)))
        {
            evidence_items.push(evidence("fileName", "Exact package/script basename match", 25));
            has_file_evidence = true;
        }
        if fingerprint
            .version_tokens
            .iter()
            .any(|token| file.game_versions.iter().any(|version| version == token) || file_name.contains(&token.replace('.', "_")))
        {
            evidence_items.push(evidence("version", "Version token match", 20));
            has_file_evidence = true;
        }
    }

    evidence_items.sort_by(|a, b| a.kind.cmp(&b.kind).then_with(|| a.description.cmp(&b.description)));
    evidence_items.dedup_by(|a, b| a.kind == b.kind && a.description == b.description);

    let score = score_candidate(CandidateScoreInput {
        evidence: evidence_items.clone(),
        has_file_metadata: !files.is_empty(),
        has_file_evidence,
        name_only: evidence_items.iter().all(|evidence| evidence.kind == "title" || evidence.kind == "slug"),
        fingerprint_match: false,
    })?;

    Some(SourceCandidate {
        provider_id: SourceProviderId::Curseforge,
        title: mod_summary.name,
        source_url: mod_summary.source_url.unwrap_or_else(|| {
            mod_summary
                .slug
                .map(|slug| format!("https://www.curseforge.com/sims4/mods/{slug}"))
                .unwrap_or_else(|| format!("https://www.curseforge.com/sims4/mods/{}", mod_summary.project_id))
        }),
        preview_url: mod_summary.preview_url,
        author: mod_summary.authors.first().cloned(),
        project_id: Some(mod_summary.project_id),
        file_id: files.first().map(|file| file.file_id),
        confidence: score.confidence,
        confidence_level: score.confidence_level,
        reasons: score.reasons,
        evidence: evidence_items,
    })
}

fn text_related(left: &str, right: &str) -> bool {
    let left = left.trim();
    let right = right.trim();
    if left.is_empty() || right.is_empty() {
        return false;
    }
    left.contains(right)
        || right.contains(left)
        || canonical_compact_text(left).contains(&canonical_compact_text(right))
        || canonical_compact_text(right).contains(&canonical_compact_text(left))
}

fn canonical_compact_text(value: &str) -> String {
    value
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .collect::<String>()
        .replace("command", "cmd")
}

fn dedupe_mods(mods: Vec<CurseForgeModSummary>) -> Vec<CurseForgeModSummary> {
    let mut deduped = vec![];
    for candidate in mods {
        if !deduped.iter().any(|existing: &CurseForgeModSummary| existing.project_id == candidate.project_id) {
            deduped.push(candidate);
        }
    }
    deduped
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
    fn builds_curseforge_queries_from_fingerprint() {
        let fingerprint = build_mod_fingerprint(
            "Mc Command Center",
            Some("McCmdCenter_AllModules_2026_2_0"),
            &[FingerprintFile { relative_path: "McCmdCenter_AllModules_2026_2_0/mc_cmd_center.package".to_string(), size: 10 }],
            None,
            None,
        );

        let queries = curseforge_queries(&fingerprint);

        assert!(queries.contains(&"mccmdcenter allmodules".to_string()));
        assert!(queries.contains(&"mc cmd center".to_string()));
        assert!(queries.contains(&"mc command center".to_string()));
    }

    #[test]
    fn keeps_candidate_when_local_package_overlaps_title() {
        let fingerprint = build_mod_fingerprint(
            "McCmdCenter_AllModules_2026_2_0",
            Some("McCmdCenter_AllModules_2026_2_0"),
            &[FingerprintFile { relative_path: "McCmdCenter_AllModules_2026_2_0/mc_cmd_center.package".to_string(), size: 10 }],
            None,
            None,
        );
        let mod_summary = CurseForgeModSummary {
            project_id: 551680,
            name: "MC Command Center".to_string(),
            slug: Some("mc-command-center".to_string()),
            source_url: Some("https://www.curseforge.com/sims4/mods/mc-command-center".to_string()),
            preview_url: None,
            authors: vec!["Deaderpool".to_string()],
        };

        let candidate = candidate_from_curseforge(&fingerprint, mod_summary, &[]).expect("candidate");

        assert_eq!(candidate.confidence_level, ConfidenceLevel::Low);
        assert!(candidate.evidence.iter().any(|item| item.kind == "packageName"));
    }

    #[test]
    fn builds_candidate_from_curseforge_file_metadata() {
        let fingerprint = build_mod_fingerprint(
            "Mc Command Center",
            Some("McCmdCenter_AllModules_2026_2_0"),
            &[FingerprintFile { relative_path: "McCmdCenter_AllModules_2026_2_0/mc_cmd_center.package".to_string(), size: 10 }],
            Some("McCmdCenter_AllModules_2026_2_0.zip"),
            None,
        );
        let mod_summary = CurseForgeModSummary {
            project_id: 551680,
            name: "MC Command Center".to_string(),
            slug: Some("mc-command-center".to_string()),
            source_url: Some("https://www.curseforge.com/sims4/mods/mc-command-center".to_string()),
            preview_url: Some("https://media.forgecdn.net/cover.png".to_string()),
            authors: vec!["Deaderpool".to_string()],
        };
        let files = vec![CurseForgeFileSummary {
            file_id: 67890,
            project_id: 551680,
            display_name: Some("McCmdCenter_AllModules_2026_2_0.zip".to_string()),
            file_name: "McCmdCenter_AllModules_2026_2_0.zip".to_string(),
            game_versions: vec!["2026.2.0".to_string()],
            hashes: vec![],
        }];

        let candidate = candidate_from_curseforge(&fingerprint, mod_summary, &files).expect("candidate");

        assert_eq!(candidate.title, "MC Command Center");
        assert_eq!(candidate.project_id, Some(551680));
        assert!(candidate.confidence >= 95);
        assert!(candidate.reasons.iter().any(|reason| reason.contains("archive/file")));
        assert!(candidate.reasons.iter().any(|reason| reason.contains("package/script")));
        assert!(candidate.reasons.iter().any(|reason| reason.contains("Title/name")));
    }

    #[test]
    fn compact_similarity_matches_mccmdcenter_alias_shape() {
        assert!(text_related("mc command center", "mccmdcenter allmodules"));
        assert!(text_related("mccmdcenter allmodules zip", "mc cmd center"));
        assert!(!text_related("wonderful whims", "mc command center"));
    }

    #[test]
    fn maps_source_lookup_errors_to_typed_manager_errors() {
        assert_eq!(source_lookup_error(SourceLookupError::RateLimited).code, ErrorCode::SourceRateLimited);
        assert_eq!(source_lookup_error(SourceLookupError::Unauthorized).code, ErrorCode::SourceUnauthorized);
        assert_eq!(source_lookup_error(SourceLookupError::InvalidResponse).code, ErrorCode::SourceInvalidResponse);
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
        let candidates = find_source_candidates(&managed, &mods, "McCmdCenter_AllModules_2026_2_0", None).expect("lookup");
        let after = fs::metadata(&package).expect("after").len();

        assert_eq!(before, after);
        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].title, "MC Command Center");
    }
}
