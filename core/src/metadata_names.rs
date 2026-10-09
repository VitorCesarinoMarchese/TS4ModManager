pub fn detect_display_name(raw: &str) -> String {
    let without_extension = raw
        .rsplit_once('.')
        .map(|(stem, _)| stem)
        .unwrap_or(raw)
        .trim();

    if let Some(bracketed) = bracketed_prefix(without_extension) {
        return bracketed;
    }

    let normalized = without_extension.to_ascii_lowercase();
    let compact = normalized
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .collect::<String>();

    if compact.contains("mccmdcenter") || compact.contains("mccommandcenter") {
        return "Mc Command Center".to_string();
    }

    if compact.contains("wickedwhims") {
        return "WickedWhims".to_string();
    }

    let mut parts = without_extension
        .split(|ch: char| matches!(ch, '_' | '-' | ' ' | '.'))
        .filter(|part| !part.trim().is_empty())
        .map(str::trim)
        .collect::<Vec<_>>();

    while parts.last().is_some_and(|part| is_version_token(part)) {
        parts.pop();
    }

    if parts.is_empty() {
        return without_extension.to_string();
    }

    if parts.len() == 1 {
        return parts[0].to_string();
    }

    parts
        .into_iter()
        .map(title_case_token)
        .collect::<Vec<_>>()
        .join(" ")
}

fn bracketed_prefix(raw: &str) -> Option<String> {
    let trimmed = raw.trim_start();
    let rest = trimmed.strip_prefix('[')?;
    let (prefix, _) = rest.split_once(']')?;
    let prefix = prefix.trim();
    (!prefix.is_empty()).then(|| {
        prefix
            .split_whitespace()
            .map(title_case_token)
            .collect::<Vec<_>>()
            .join(" ")
    })
}

fn is_version_token(token: &str) -> bool {
    let lower = token.to_ascii_lowercase();
    lower.chars().all(|ch| ch.is_ascii_digit())
        || lower
            .strip_prefix('v')
            .is_some_and(|rest| !rest.is_empty() && rest.chars().all(|ch| ch.is_ascii_digit()))
}

fn title_case_token(token: &str) -> String {
    let mut chars = token.chars();
    let Some(first) = chars.next() else {
        return String::new();
    };

    let mut out = first.to_uppercase().collect::<String>();
    out.push_str(&chars.as_str().to_ascii_lowercase());
    out
}

#[cfg(test)]
mod tests {
    use super::detect_display_name;

    #[test]
    fn detects_known_mccc_alias() {
        assert_eq!(
            detect_display_name("McCmdCenter_AllModules_2026_2_0"),
            "Mc Command Center"
        );
    }

    #[test]
    fn detects_known_wicked_whims_alias() {
        assert_eq!(detect_display_name("wickedwhims_v182"), "WickedWhims");
    }

    #[test]
    fn removes_versions_and_title_cases_unknown_names() {
        assert_eq!(
            detect_display_name("random_mod_file_1_2_3"),
            "Random Mod File"
        );
    }

    #[test]
    fn uses_bracketed_creator_prefix_without_brackets() {
        assert_eq!(
            detect_display_name("[Gabymelove Sims] Converse Platform High Tops (M) • CF Edition — Base Colors Update C80.package"),
            "Gabymelove Sims"
        );
    }
}
