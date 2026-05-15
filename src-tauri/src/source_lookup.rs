use std::fs;
use std::path::Path;

use crate::curseforge_client::{
    CurseForgeClient, CurseForgeFileSummary, CurseForgeModSummary, SourceLookupError,
    UreqCurseForgeTransport,
};
use crate::error::{ErrorCode, ManagerError};
use crate::managed_storage::read_managed_mod;
use crate::mod_scan::{scan_mods, ScannedMod};
use crate::source_candidates::{SourceCandidate, SourceProviderId};
use crate::source_fingerprint::{
    build_mod_fingerprint, normalize_name, FingerprintFile, ModFingerprint,
};
use crate::source_scoring::{evidence, score_candidate, CandidateScoreInput};

const MAX_CURSEFORGE_QUERIES: usize = 6;

pub fn find_source_candidates(
    managed_root: &Path,
    game_mods_dir: &Path,
    mod_id: &str,
    api_key: Option<&str>,
) -> Result<Vec<SourceCandidate>, ManagerError> {
    let fingerprint = fingerprint_for_lookup(managed_root, game_mods_dir, mod_id)?;

    if api_key.is_some_and(|key| !key.trim().is_empty()) {
        match find_with_curseforge(&fingerprint, api_key) {
            Ok(candidates) => return Ok(candidates),
            Err(SourceLookupError::MissingApiKey) => {}
            Err(err) => return Err(source_lookup_error(err)),
        }
    }

    Ok(fixture_provider_candidates(&fingerprint))
}

fn fingerprint_for_lookup(
    managed_root: &Path,
    game_mods_dir: &Path,
    mod_id: &str,
) -> Result<ModFingerprint, ManagerError> {
    let scanned = scan_mods(game_mods_dir, managed_root);
    if let Some(selected) = scanned
        .iter()
        .find(|mod_entry| matches_mod_id(mod_entry, mod_id))
    {
        let files = selected
            .files
            .iter()
            .map(|relative| FingerprintFile {
                relative_path: relative.clone(),
                size: fs::metadata(game_mods_dir.join(relative))
                    .map(|meta| meta.len())
                    .unwrap_or(0),
            })
            .collect::<Vec<_>>();
        let folder_name = selected.group_path.first().map(String::as_str);
        return Ok(build_mod_fingerprint(
            &selected.name,
            folder_name,
            &files,
            None,
            selected.source_url.as_deref(),
        ));
    }

    let meta = read_managed_mod(managed_root, mod_id).map_err(|_| {
        ManagerError::new(
            ErrorCode::NotFound,
            format!("Mod not found for source lookup: {mod_id}"),
        )
    })?;
    let files_root = managed_root.join("mods").join(&meta.mod_id).join("files");
    let files = meta
        .files
        .iter()
        .map(|relative| FingerprintFile {
            relative_path: relative.clone(),
            size: fs::metadata(files_root.join(relative))
                .map(|meta| meta.len())
                .unwrap_or(0),
        })
        .collect::<Vec<_>>();
    let folder_name = meta.files.first().and_then(|file| file.split('/').next());
    Ok(build_mod_fingerprint(
        meta.effective_display_name(),
        folder_name,
        &files,
        None,
        meta.source_url.as_deref(),
    ))
}

fn matches_mod_id(mod_entry: &ScannedMod, mod_id: &str) -> bool {
    mod_entry.id.as_deref() == Some(mod_id) || mod_entry.key == mod_id || mod_entry.name == mod_id
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

fn find_with_curseforge(
    fingerprint: &ModFingerprint,
    api_key: Option<&str>,
) -> Result<Vec<SourceCandidate>, SourceLookupError> {
    let client = CurseForgeClient::new(api_key, UreqCurseForgeTransport)?;
    let mut mods = vec![];
    for query in curseforge_queries(fingerprint) {
        mods.extend(client.search_mods(&query)?);
        mods.extend(client.search_mods_by_slug(&query.replace(' ', "-"))?);
    }
    mods = prioritize_mod_summaries(fingerprint, dedupe_mods(mods));

    let mut candidates = vec![];
    for mod_summary in mods.into_iter().take(12) {
        let files = client
            .get_mod_files(mod_summary.project_id)
            .unwrap_or_default();
        if let Some(candidate) = candidate_from_curseforge(fingerprint, mod_summary, &files) {
            candidates.push(candidate);
        }
    }
    candidates.sort_by(|a, b| b.confidence.cmp(&a.confidence));
    candidates.truncate(5);
    Ok(candidates)
}

pub fn curseforge_queries(fingerprint: &ModFingerprint) -> Vec<String> {
    let mut queries = vec![];
    for query in structured_filename_queries(fingerprint) {
        push_query(&mut queries, query);
    }
    push_query(&mut queries, fingerprint.normalized_name.clone());
    push_query(&mut queries, normalize_name(&fingerprint.display_name));
    if let Some(folder) = &fingerprint.folder_name {
        push_query(&mut queries, normalize_name(folder));
    }
    let simplified_roots = queries
        .iter()
        .filter_map(|query| without_packaging_terms(query))
        .collect::<Vec<_>>();
    for query in simplified_roots {
        push_query(&mut queries, query);
    }
    let without_catalog_codes = queries
        .iter()
        .filter_map(|query| without_catalog_code_tokens(query))
        .collect::<Vec<_>>();
    for query in without_catalog_codes {
        push_query(&mut queries, query);
    }
    let expanded = queries
        .iter()
        .flat_map(|query| abbreviation_expansions(query))
        .collect::<Vec<_>>();
    for query in expanded {
        push_query(&mut queries, query);
    }
    for file in &fingerprint.package_script_basenames {
        push_query(&mut queries, normalize_name(file));
        if queries.len() >= MAX_CURSEFORGE_QUERIES {
            break;
        }
    }
    queries.truncate(MAX_CURSEFORGE_QUERIES);
    queries
}

fn structured_filename_queries(fingerprint: &ModFingerprint) -> Vec<String> {
    let mut queries = collection_filename_queries(fingerprint);
    let mut sources = vec![fingerprint.display_name.as_str()];
    if let Some(folder) = &fingerprint.folder_name {
        sources.push(folder.as_str());
    }
    sources.extend(
        fingerprint
            .package_script_basenames
            .iter()
            .map(String::as_str),
    );

    for source in sources {
        if let Some(parts) = parse_author_mod_filename(source) {
            let author = normalize_name(&parts.author);
            let mod_name = normalize_name(&parts.mod_name);
            let author_mod = format!("{author} {mod_name}");
            let author_mod_without_packaging = without_packaging_terms(&author_mod);
            if let Some(without_packaging) = author_mod_without_packaging.clone() {
                push_query(&mut queries, without_packaging);
            }
            if let Some(without_codes) = without_catalog_code_tokens(
                author_mod_without_packaging
                    .as_deref()
                    .unwrap_or(&author_mod),
            ) {
                push_query(&mut queries, without_codes);
            }
            push_query(&mut queries, author_mod);
            if let Some(mod_without_codes) = without_catalog_code_tokens(&mod_name) {
                push_query(&mut queries, format!("{author} {mod_without_codes}"));
            }
        }
    }
    queries
}

fn collection_filename_queries(fingerprint: &ModFingerprint) -> Vec<String> {
    let parsed = fingerprint
        .package_script_basenames
        .iter()
        .filter_map(|name| parse_author_mod_filename(name))
        .collect::<Vec<_>>();
    if parsed.len() < 2 {
        return vec![];
    }

    let tokenized_mods = parsed
        .iter()
        .map(|parts| searchable_tokens(&parts.mod_name))
        .filter(|tokens| !tokens.is_empty())
        .collect::<Vec<_>>();
    let common_prefix = common_token_prefix(&tokenized_mods);
    if common_prefix.len() < 2 {
        return vec![];
    }

    let collection_name = common_prefix.join(" ");
    let display_context = normalize_name(&format!(
        "{} {}",
        fingerprint.display_name,
        fingerprint.folder_name.as_deref().unwrap_or_default()
    ));
    let mut authors = vec![];
    for parts in &parsed {
        for author in split_collaboration_authors(&parts.author) {
            push_query(&mut authors, author);
        }
    }
    authors.sort_by_key(|author| !display_context.contains(author));

    let mut queries = vec![];
    for author in authors {
        push_query(&mut queries, format!("{author} {collection_name}"));
        push_query(&mut queries, format!("{collection_name} {author}"));
    }
    queries
}

fn searchable_tokens(raw: &str) -> Vec<String> {
    normalize_name(raw)
        .split_whitespace()
        .filter(|token| !is_catalog_code_token(token))
        .filter(|token| !matches!(*token, "file" | "files" | "package" | "packages"))
        .map(ToString::to_string)
        .collect()
}

fn common_token_prefix(token_lists: &[Vec<String>]) -> Vec<String> {
    let Some(first) = token_lists.first() else {
        return vec![];
    };
    let mut prefix = vec![];
    for (index, token) in first.iter().enumerate() {
        if token_lists
            .iter()
            .all(|tokens| tokens.get(index) == Some(token))
        {
            prefix.push(token.clone());
        } else {
            break;
        }
    }
    prefix
}

fn split_collaboration_authors(raw: &str) -> Vec<String> {
    let tokens = normalize_name(raw)
        .split_whitespace()
        .map(ToString::to_string)
        .collect::<Vec<_>>();
    let has_separator = tokens
        .iter()
        .any(|token| matches!(token.as_str(), "x" | "and"));
    if !has_separator {
        let author = tokens.join(" ");
        return (!author.is_empty()).then_some(author).into_iter().collect();
    }

    let mut authors = vec![];
    let mut current = vec![];
    for token in tokens {
        if matches!(token.as_str(), "x" | "and") {
            if !current.is_empty() {
                push_query(&mut authors, current.join(" "));
                current.clear();
            }
        } else {
            current.push(token);
        }
    }
    if !current.is_empty() {
        push_query(&mut authors, current.join(" "));
    }
    authors
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ParsedFilenameParts {
    author: String,
    mod_name: String,
}

fn parse_author_mod_filename(raw: &str) -> Option<ParsedFilenameParts> {
    let stem = raw
        .rsplit('/')
        .next()
        .unwrap_or(raw)
        .rsplit_once('.')
        .map(|(stem, _)| stem)
        .unwrap_or(raw)
        .trim();
    if stem.is_empty() {
        return None;
    }
    if let Some(rest) = stem.strip_prefix('[') {
        let (author, mod_name) = rest.split_once(']')?;
        let author = author.trim();
        let mod_name = mod_name.trim();
        if !author.is_empty() && !mod_name.is_empty() {
            return Some(ParsedFilenameParts {
                author: author.to_string(),
                mod_name: mod_name.to_string(),
            });
        }
    }
    let (author, mod_name) = stem.split_once('_')?;
    let author = author.trim();
    let mod_name = mod_name.trim();
    (!author.is_empty() && !mod_name.is_empty()).then(|| ParsedFilenameParts {
        author: author.to_string(),
        mod_name: mod_name.to_string(),
    })
}

fn push_query(queries: &mut Vec<String>, query: String) {
    let trimmed = query.trim();
    if !trimmed.is_empty() && !queries.iter().any(|existing| existing == trimmed) {
        queries.push(trimmed.to_string());
    }
}

fn abbreviation_expansions(query: &str) -> Vec<String> {
    let tokens = query.split_whitespace().collect::<Vec<_>>();
    let mut expansions = vec![];
    if tokens.contains(&"cmd") {
        expansions.push(
            tokens
                .iter()
                .map(|token| if *token == "cmd" { "command" } else { token })
                .collect::<Vec<_>>()
                .join(" "),
        );
    }
    if tokens.contains(&"command") {
        expansions.push(
            tokens
                .iter()
                .map(|token| if *token == "command" { "cmd" } else { token })
                .collect::<Vec<_>>()
                .join(" "),
        );
    }
    expansions
}

fn without_catalog_code_tokens(query: &str) -> Option<String> {
    let filtered = query
        .split_whitespace()
        .filter(|part| !is_catalog_code_token(part))
        .collect::<Vec<_>>()
        .join(" ");
    (!filtered.is_empty() && filtered != query).then_some(filtered)
}

fn is_catalog_code_token(token: &str) -> bool {
    let trimmed = token.trim_matches(|ch: char| !ch.is_ascii_alphanumeric());
    let has_digit = trimmed.chars().any(|ch| ch.is_ascii_digit());
    let has_alpha = trimmed.chars().any(|ch| ch.is_ascii_alphabetic());
    has_digit && has_alpha && trimmed.len() <= 8
}

fn without_packaging_terms(query: &str) -> Option<String> {
    let packaging_terms = [
        "all", "module", "modules", "merged", "package", "packages", "script", "scripts", "files",
    ];
    let filtered = query
        .split_whitespace()
        .filter(|part| !packaging_terms.contains(part))
        .collect::<Vec<_>>()
        .join(" ");
    (!filtered.is_empty() && filtered != query).then_some(filtered)
}

pub fn candidate_from_curseforge(
    fingerprint: &ModFingerprint,
    mod_summary: CurseForgeModSummary,
    files: &[CurseForgeFileSummary],
) -> Option<SourceCandidate> {
    let source_url = mod_summary
        .source_url
        .clone()
        .filter(|url| !url.trim().is_empty())?;
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
    let shared_tokens = shared_meaningful_token_count(
        &fingerprint.normalized_name,
        &format!(
            "{} {}",
            normalized_title,
            normalized_slug.as_deref().unwrap_or_default()
        ),
    );
    if shared_tokens >= 2 {
        evidence_items.push(evidence(
            "tokenOverlap",
            "Provider title/slug shares distinctive local filename tokens",
            (shared_tokens.min(3) * 5) as i16,
        ));
    }
    if looks_like_translation_project(&mod_summary.name, mod_summary.slug.as_deref())
        && !looks_like_translation_project(
            &fingerprint.display_name,
            fingerprint.folder_name.as_deref(),
        )
    {
        evidence_items.push(evidence(
            "translation",
            "Translation/localization project, not original mod",
            -35,
        ));
    }

    let mut has_file_evidence = false;
    if fingerprint.package_script_basenames.iter().any(|name| {
        let normalized = normalize_name(name);
        text_related(&normalized, &normalized_title)
            || normalized_slug
                .as_deref()
                .is_some_and(|slug| text_related(&normalized, slug))
    }) {
        evidence_items.push(evidence(
            "packageName",
            "Package/script basename overlaps title or slug",
            15,
        ));
        has_file_evidence = true;
    }
    for file in files {
        let file_name = file.file_name.to_lowercase();
        if fingerprint
            .archive_name
            .as_ref()
            .is_some_and(|archive| archive.eq_ignore_ascii_case(&file.file_name))
        {
            evidence_items.push(evidence("fileName", "Exact archive/file name match", 40));
            has_file_evidence = true;
        }
        if fingerprint
            .package_script_basenames
            .iter()
            .any(|name| text_related(&normalize_name(&file_name), &normalize_name(name)))
        {
            evidence_items.push(evidence(
                "fileName",
                "Exact package/script basename match",
                25,
            ));
            has_file_evidence = true;
        }
        if fingerprint.version_tokens.iter().any(|token| {
            file.game_versions.iter().any(|version| version == token)
                || file_name.contains(&token.replace('.', "_"))
        }) {
            evidence_items.push(evidence("version", "Version token match", 20));
            has_file_evidence = true;
        }
    }

    evidence_items.sort_by(|a, b| {
        a.kind
            .cmp(&b.kind)
            .then_with(|| a.description.cmp(&b.description))
    });
    evidence_items.dedup_by(|a, b| a.kind == b.kind && a.description == b.description);

    let score = score_candidate(CandidateScoreInput {
        evidence: evidence_items.clone(),
        has_file_metadata: !files.is_empty(),
        has_file_evidence,
        name_only: evidence_items
            .iter()
            .all(|evidence| evidence.kind == "title" || evidence.kind == "slug"),
        fingerprint_match: false,
    })?;

    Some(SourceCandidate {
        provider_id: SourceProviderId::Curseforge,
        title: mod_summary.name,
        source_url,
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
        || significant_token_overlap(left, right)
}

fn shared_meaningful_token_count(left: &str, right: &str) -> usize {
    let left_tokens = meaningful_tokens(left);
    let right_tokens = meaningful_tokens(right);
    left_tokens
        .iter()
        .filter(|token| right_tokens.contains(token))
        .count()
}

fn significant_token_overlap(left: &str, right: &str) -> bool {
    let left_tokens = meaningful_tokens(left);
    let right_tokens = meaningful_tokens(right);
    if left_tokens.len() < 2 || right_tokens.len() < 2 {
        return false;
    }
    let shared = left_tokens
        .iter()
        .filter(|token| right_tokens.contains(token))
        .count();
    shared >= 2 && shared * 2 >= left_tokens.len().min(right_tokens.len())
}

fn meaningful_tokens(value: &str) -> Vec<String> {
    value
        .split_whitespace()
        .map(str::trim)
        .filter(|token| token.len() >= 3)
        .filter(|token| !is_catalog_code_token(token))
        .map(|token| token.replace("command", "cmd"))
        .collect()
}

fn canonical_compact_text(value: &str) -> String {
    value
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .collect::<String>()
        .replace("command", "cmd")
}

fn prioritize_mod_summaries(
    fingerprint: &ModFingerprint,
    mut mods: Vec<CurseForgeModSummary>,
) -> Vec<CurseForgeModSummary> {
    mods.sort_by(|a, b| {
        preliminary_mod_rank(fingerprint, b).cmp(&preliminary_mod_rank(fingerprint, a))
    });
    mods
}

fn preliminary_mod_rank(fingerprint: &ModFingerprint, candidate: &CurseForgeModSummary) -> i16 {
    let normalized_title = normalize_name(&candidate.name);
    let normalized_slug = candidate
        .slug
        .as_deref()
        .map(normalize_name)
        .unwrap_or_default();
    let mut score = 0;
    if normalized_title == normalize_name(&fingerprint.display_name) {
        score += 80;
    }
    if text_related(&normalized_title, &fingerprint.normalized_name) {
        score += 30;
    }
    if !normalized_slug.is_empty() && text_related(&normalized_slug, &fingerprint.normalized_name) {
        score += 20;
    }
    score += (shared_meaningful_token_count(
        &fingerprint.normalized_name,
        &format!("{normalized_title} {normalized_slug}"),
    ) as i16)
        * 5;
    if looks_like_translation_project(&candidate.name, candidate.slug.as_deref())
        && !looks_like_translation_project(
            &fingerprint.display_name,
            fingerprint.folder_name.as_deref(),
        )
    {
        score -= 100;
    }
    score
}

fn looks_like_translation_project(title: &str, slug: Option<&str>) -> bool {
    let haystack = format!("{} {}", title, slug.unwrap_or_default()).to_ascii_lowercase();
    [
        "translation",
        "translations",
        "translate",
        "localization",
        "spanish",
        "espanol",
        "español",
        "portuguese",
        "french",
        "german",
        "italian",
        "russian",
        "chinese",
        "japanese",
        "korean",
    ]
    .iter()
    .any(|term| haystack.contains(term))
}

fn dedupe_mods(mods: Vec<CurseForgeModSummary>) -> Vec<CurseForgeModSummary> {
    let mut deduped = vec![];
    for candidate in mods {
        if !deduped
            .iter()
            .any(|existing: &CurseForgeModSummary| existing.project_id == candidate.project_id)
        {
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

    if !(joined.contains("mccmdcenter")
        || joined.contains("mc command")
        || joined.contains("mc_cmd_center"))
    {
        return vec![];
    }

    let mut evidence_items = vec![
        evidence(
            "fileName",
            "Matched MC Command Center package/script basename",
            25,
        ),
        evidence("title", "Title/name similarity", 20),
        evidence("slug", "Slug similarity", 10),
    ];
    if fingerprint
        .version_tokens
        .iter()
        .any(|token| token == "2026.2.0")
    {
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
    use crate::managed_storage::{write_managed_mod, ModMetadata};
    use crate::source_candidates::ConfidenceLevel;
    use tempfile::TempDir;

    #[test]
    fn fixture_provider_returns_candidate_from_file_evidence() {
        let fingerprint = build_mod_fingerprint(
            "Mc Command Center",
            Some("McCmdCenter_AllModules_2026_2_0"),
            &[FingerprintFile {
                relative_path: "McCmdCenter_AllModules_2026_2_0/mc_cmd_center.package".to_string(),
                size: 10,
            }],
            None,
            None,
        );

        let candidates = fixture_provider_candidates(&fingerprint);
        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].provider_id, SourceProviderId::Curseforge);
        assert_eq!(candidates[0].confidence_level, ConfidenceLevel::Medium);
        assert!(candidates[0]
            .reasons
            .iter()
            .any(|reason| reason.contains("package/script")));
    }

    #[test]
    fn fixture_provider_returns_empty_for_unrelated_mod() {
        let fingerprint = build_mod_fingerprint(
            "Random Trait",
            Some("RandomTrait"),
            &[FingerprintFile {
                relative_path: "RandomTrait/random_trait.package".to_string(),
                size: 10,
            }],
            None,
            None,
        );

        assert!(fixture_provider_candidates(&fingerprint).is_empty());
    }

    #[test]
    fn builds_general_curseforge_queries_from_fingerprint() {
        let fingerprint = build_mod_fingerprint(
            "McCmdCenter_AllModules_2026_2_0",
            Some("McCmdCenter_AllModules_2026_2_0"),
            &[
                FingerprintFile {
                    relative_path: "McCmdCenter_AllModules_2026_2_0/mc_career.ts4script"
                        .to_string(),
                    size: 10,
                },
                FingerprintFile {
                    relative_path: "McCmdCenter_AllModules_2026_2_0/mc_cmd_center.package"
                        .to_string(),
                    size: 10,
                },
            ],
            None,
            None,
        );

        let queries = curseforge_queries(&fingerprint);

        assert_eq!(queries[0], "mc cmd center");
        assert!(queries.contains(&"mc cmd center".to_string()));
        assert!(queries.contains(&"mc command center".to_string()));
        assert!(queries.contains(&"mc career".to_string()));
        assert!(!queries.contains(&"mccc".to_string()));
    }

    #[test]
    fn parses_structured_author_mod_filenames() {
        assert_eq!(
            parse_author_mod_filename("Aurum_HairstyleF178_Serana.package"),
            Some(ParsedFilenameParts {
                author: "Aurum".to_string(),
                mod_name: "HairstyleF178_Serana".to_string(),
            })
        );
        assert_eq!(
            parse_author_mod_filename("[Gabymelove Sims] Converse Platform High Tops (M).package"),
            Some(ParsedFilenameParts {
                author: "Gabymelove Sims".to_string(),
                mod_name: "Converse Platform High Tops (M)".to_string(),
            })
        );
        assert_eq!(
            parse_author_mod_filename("moonmoonsim_botanica_f_tattoo.package"),
            Some(ParsedFilenameParts {
                author: "moonmoonsim".to_string(),
                mod_name: "botanica_f_tattoo".to_string(),
            })
        );
    }

    #[test]
    fn builds_collection_queries_from_shared_file_prefix_and_display_author() {
        let fingerprint = build_mod_fingerprint(
            "Sweater Weather Qicc's",
            Some("Sweater Weather Qicc's"),
            &[
                FingerprintFile {
                    relative_path: "[oakiyo_x_QICC]Sweater_Weather_Bronwyn_Outfit.package"
                        .to_string(),
                    size: 10,
                },
                FingerprintFile {
                    relative_path: "[oakiyo_x_QICC]Sweater_Weather_Demeter_Cardigan.package"
                        .to_string(),
                    size: 10,
                },
                FingerprintFile {
                    relative_path: "[oakiyo_x_QICC]Sweater_Weather_Gaia_Hair.package".to_string(),
                    size: 10,
                },
            ],
            None,
            None,
        );

        let queries = curseforge_queries(&fingerprint);

        assert_eq!(queries[0], "qicc sweater weather");
        assert!(queries.contains(&"sweater weather qicc".to_string()));
    }

    #[test]
    fn removes_catalog_codes_from_curseforge_queries() {
        let fingerprint = build_mod_fingerprint(
            "Aurum HairstyleF178 Serana",
            Some("Aurum HairstyleF178 Serana"),
            &[FingerprintFile {
                relative_path: "Aurum_HairstyleF178_Serana.package".to_string(),
                size: 10,
            }],
            None,
            None,
        );

        let queries = curseforge_queries(&fingerprint);

        assert_eq!(queries[0], "aurum hairstyle serana");
        assert!(queries.contains(&"aurum hairstyle serana".to_string()));
    }

    #[test]
    fn matches_reordered_title_when_catalog_code_differs() {
        let fingerprint = build_mod_fingerprint(
            "Aurum HairstyleF178 Serana",
            Some("Aurum HairstyleF178 Serana"),
            &[FingerprintFile {
                relative_path: "Aurum_HairstyleF178_Serana.package".to_string(),
                size: 10,
            }],
            None,
            None,
        );
        let mod_summary = CurseForgeModSummary {
            project_id: 1291154,
            name: "Aurum - Serana hairstyle".to_string(),
            slug: Some("aurum-serana-hairstyle".to_string()),
            source_url: Some(
                "https://www.curseforge.com/sims4/create-a-sim/aurum-serana-hairstyle".to_string(),
            ),
            preview_url: None,
            authors: vec!["Aurum".to_string()],
        };

        let candidate =
            candidate_from_curseforge(&fingerprint, mod_summary, &[]).expect("candidate");

        assert_eq!(candidate.project_id, Some(1291154));
        assert!(candidate
            .evidence
            .iter()
            .any(|item| item.kind == "packageName"));
        assert!(candidate
            .evidence
            .iter()
            .any(|item| item.kind == "tokenOverlap"));
    }

    #[test]
    fn ranks_specific_token_matches_above_generic_author_matches() {
        let fingerprint = build_mod_fingerprint(
            "Aurum HairstyleF178 Serana",
            Some("Aurum HairstyleF178 Serana"),
            &[FingerprintFile {
                relative_path: "Aurum_HairstyleF178_Serana.package".to_string(),
                size: 10,
            }],
            None,
            None,
        );
        let serana = CurseForgeModSummary {
            project_id: 1291154,
            name: "Aurum - Serana hairstyle".to_string(),
            slug: Some("aurum-serana-hairstyle".to_string()),
            source_url: Some(
                "https://www.curseforge.com/sims4/create-a-sim/aurum-serana-hairstyle".to_string(),
            ),
            preview_url: None,
            authors: vec!["Aurum".to_string()],
        };
        let lisa = CurseForgeModSummary {
            project_id: 1533589,
            name: "Aurum - Lisa hairstyle (skysims edit)".to_string(),
            slug: Some("aurum-lisa-hairstyle-skysims-edit".to_string()),
            source_url: Some(
                "https://www.curseforge.com/sims4/create-a-sim/aurum-lisa-hairstyle-skysims-edit"
                    .to_string(),
            ),
            preview_url: None,
            authors: vec!["AuSims".to_string()],
        };

        let serana = candidate_from_curseforge(&fingerprint, serana, &[]).expect("serana");
        let lisa = candidate_from_curseforge(&fingerprint, lisa, &[]).expect("lisa");

        assert!(serana.confidence > lisa.confidence);
    }

    #[test]
    fn caps_curseforge_queries_to_limit_lag() {
        let files = (0..20)
            .map(|index| FingerprintFile {
                relative_path: format!("BigMod/package_part_{index}.package"),
                size: 10,
            })
            .collect::<Vec<_>>();
        let fingerprint = build_mod_fingerprint(
            "BigMod_AllModules_1_0",
            Some("BigMod_AllModules_1_0"),
            &files,
            None,
            None,
        );

        let queries = curseforge_queries(&fingerprint);

        assert!(queries.len() <= MAX_CURSEFORGE_QUERIES);
        assert_eq!(queries[0], "big mod");
        assert!(queries.contains(&"big mod".to_string()));
    }

    #[test]
    fn keeps_candidate_when_local_package_overlaps_title() {
        let fingerprint = build_mod_fingerprint(
            "McCmdCenter_AllModules_2026_2_0",
            Some("McCmdCenter_AllModules_2026_2_0"),
            &[FingerprintFile {
                relative_path: "McCmdCenter_AllModules_2026_2_0/mc_cmd_center.package".to_string(),
                size: 10,
            }],
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

        let candidate =
            candidate_from_curseforge(&fingerprint, mod_summary, &[]).expect("candidate");

        assert_eq!(candidate.confidence_level, ConfidenceLevel::Low);
        assert!(candidate
            .evidence
            .iter()
            .any(|item| item.kind == "packageName"));
    }

    #[test]
    fn rejects_candidate_without_real_provider_url() {
        let fingerprint = build_mod_fingerprint(
            "MC Command Center",
            Some("McCmdCenter_AllModules_2026_2_0"),
            &[FingerprintFile {
                relative_path: "McCmdCenter_AllModules_2026_2_0/mc_cmd_center.package".to_string(),
                size: 10,
            }],
            None,
            None,
        );
        let mod_summary = CurseForgeModSummary {
            project_id: 663350,
            name: "MC Command Center".to_string(),
            slug: Some("mc-command-center".to_string()),
            source_url: None,
            preview_url: None,
            authors: vec!["deaderpool_mccc".to_string()],
        };

        assert!(candidate_from_curseforge(&fingerprint, mod_summary, &[]).is_none());
    }

    #[test]
    fn translation_candidate_scores_below_original_project() {
        let fingerprint = build_mod_fingerprint(
            "Mc Command Center",
            Some("McCmdCenter_AllModules_2026_2_0"),
            &[FingerprintFile {
                relative_path: "McCmdCenter_AllModules_2026_2_0/mc_cmd_center.package".to_string(),
                size: 10,
            }],
            Some("McCmdCenter_AllModules_2026_2_0.zip"),
            None,
        );
        let original = CurseForgeModSummary {
            project_id: 663350,
            name: "MC Command Center".to_string(),
            slug: Some("mc-command-center".to_string()),
            source_url: Some("https://www.curseforge.com/sims4/mods/mc-command-center".to_string()),
            preview_url: None,
            authors: vec!["deaderpool_mccc".to_string()],
        };
        let translation = CurseForgeModSummary {
            project_id: 1179333,
            name: "MC Command Center (deaderpool_mccc) / translation spanish by dokimtz".to_string(),
            slug: Some("mc-command-center-deaderpool-mccc-translation-spanish-by-dokimtz".to_string()),
            source_url: Some("https://www.curseforge.com/sims4/mods/mc-command-center-deaderpool-mccc-translation-spanish-by-dokimtz".to_string()),
            preview_url: None,
            authors: vec!["dokimtz".to_string()],
        };

        let original = candidate_from_curseforge(&fingerprint, original, &[]).expect("original");
        let translation = candidate_from_curseforge(&fingerprint, translation, &[]);

        assert!(original.confidence >= 40);
        assert!(translation.is_none());
    }

    #[test]
    fn builds_candidate_from_curseforge_file_metadata() {
        let fingerprint = build_mod_fingerprint(
            "Mc Command Center",
            Some("McCmdCenter_AllModules_2026_2_0"),
            &[FingerprintFile {
                relative_path: "McCmdCenter_AllModules_2026_2_0/mc_cmd_center.package".to_string(),
                size: 10,
            }],
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

        let candidate =
            candidate_from_curseforge(&fingerprint, mod_summary, &files).expect("candidate");

        assert_eq!(candidate.title, "MC Command Center");
        assert_eq!(candidate.project_id, Some(551680));
        assert!(candidate.confidence >= 95);
        assert!(candidate
            .reasons
            .iter()
            .any(|reason| reason.contains("archive/file")));
        assert!(candidate
            .reasons
            .iter()
            .any(|reason| reason.contains("package/script")));
        assert!(candidate
            .reasons
            .iter()
            .any(|reason| reason.contains("Title/name")));
    }

    #[test]
    fn compact_similarity_matches_mccmdcenter_alias_shape() {
        assert!(text_related("mc command center", "mccmdcenter allmodules"));
        assert!(text_related("mccmdcenter allmodules zip", "mc cmd center"));
        assert!(!text_related("wonderful whims", "mc command center"));
    }

    #[test]
    fn maps_source_lookup_errors_to_typed_manager_errors() {
        assert_eq!(
            source_lookup_error(SourceLookupError::RateLimited).code,
            ErrorCode::SourceRateLimited
        );
        assert_eq!(
            source_lookup_error(SourceLookupError::Unauthorized).code,
            ErrorCode::SourceUnauthorized
        );
        assert_eq!(
            source_lookup_error(SourceLookupError::InvalidResponse).code,
            ErrorCode::SourceInvalidResponse
        );
    }

    #[test]
    fn command_finds_disabled_imported_managed_mod_by_metadata() {
        let tmp = TempDir::new().expect("tmp");
        let managed = tmp.path().join("managed");
        let mods = tmp.path().join("Mods");
        let mod_id = "imported-id";
        let managed_file =
            managed.join("mods/imported-id/files/Aurum_HairstyleF178_Serana.package");
        fs::create_dir_all(managed_file.parent().expect("parent")).expect("managed dirs");
        fs::create_dir_all(&mods).expect("mods");
        fs::write(&managed_file, b"pkg").expect("pkg");
        write_managed_mod(
            &managed,
            &ModMetadata {
                version: 1,
                created_by: "sims4-mod-manager".to_string(),
                mod_id: mod_id.to_string(),
                name: "Aurum Hairstylef178 Serana".to_string(),
                display_name: "Aurum Hairstylef178 Serana".to_string(),
                detected_name: Some("Aurum Hairstylef178 Serana".to_string()),
                custom_name: None,
                slug: None,
                files: vec!["Aurum_HairstyleF178_Serana.package".to_string()],
                source: "local".to_string(),
                source_url: None,
                preview_url: None,
                local_preview_path: None,
                source_attachment: None,
                locked_name: false,
                updated_at: None,
            },
        )
        .expect("meta");

        let candidates = find_source_candidates(&managed, &mods, mod_id, None).expect("lookup");

        assert_eq!(
            candidates,
            fixture_provider_candidates(
                &fingerprint_for_lookup(&managed, &mods, mod_id).expect("fingerprint")
            )
        );
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
        let candidates =
            find_source_candidates(&managed, &mods, "McCmdCenter_AllModules_2026_2_0", None)
                .expect("lookup");
        let after = fs::metadata(&package).expect("after").len();

        assert_eq!(before, after);
        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].title, "MC Command Center");
    }
}
