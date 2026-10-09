use crate::source_candidates::{ConfidenceLevel, SourceEvidence};

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct CandidateScoreInput {
    pub evidence: Vec<SourceEvidence>,
    pub has_file_metadata: bool,
    pub has_file_evidence: bool,
    pub name_only: bool,
    pub fingerprint_match: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CandidateScore {
    pub confidence: u8,
    pub confidence_level: ConfidenceLevel,
    pub evidence: Vec<SourceEvidence>,
    pub reasons: Vec<String>,
}

pub fn score_candidate(input: CandidateScoreInput) -> Option<CandidateScore> {
    let raw_score = input.evidence.iter().map(|evidence| evidence.weight).sum::<i16>();
    let mut score = raw_score.clamp(0, 100) as u8;

    if input.name_only {
        score = score.min(55);
    }
    if !input.has_file_evidence {
        score = score.min(60);
    }
    if !input.has_file_metadata {
        score = score.min(70);
    }
    if input.fingerprint_match && raw_score > 0 {
        score = score.max(85);
    }

    let confidence_level = ConfidenceLevel::from_score(score)?;
    let reasons = input
        .evidence
        .iter()
        .filter(|evidence| evidence.weight > 0)
        .map(|evidence| evidence.description.clone())
        .collect();

    Some(CandidateScore {
        confidence: score,
        confidence_level,
        evidence: input.evidence,
        reasons,
    })
}

pub fn evidence(kind: &str, description: &str, weight: i16) -> SourceEvidence {
    SourceEvidence {
        kind: kind.to_string(),
        description: description.to_string(),
        weight,
    }
}

pub fn sort_scores(mut scores: Vec<CandidateScore>) -> Vec<CandidateScore> {
    scores.sort_by(|a, b| b.confidence.cmp(&a.confidence).then_with(|| a.reasons.join("|").cmp(&b.reasons.join("|"))));
    scores
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ranks_fingerprint_match_as_high_confidence() {
        let score = score_candidate(CandidateScoreInput {
            evidence: vec![evidence("fingerprint", "Exact fingerprint match", 95)],
            has_file_metadata: true,
            has_file_evidence: true,
            name_only: false,
            fingerprint_match: true,
        })
        .expect("score");

        assert_eq!(score.confidence, 95);
        assert_eq!(score.confidence_level, ConfidenceLevel::High);
    }

    #[test]
    fn exact_filename_beats_name_only() {
        let filename = score_candidate(CandidateScoreInput {
            evidence: vec![evidence("fileName", "Exact archive/file name match", 40), evidence("title", "Title/name similarity", 20)],
            has_file_metadata: true,
            has_file_evidence: true,
            name_only: false,
            fingerprint_match: false,
        })
        .expect("filename score");
        let name_only = score_candidate(CandidateScoreInput {
            evidence: vec![evidence("title", "Title/name similarity", 20), evidence("slug", "Slug similarity", 10)],
            has_file_metadata: false,
            has_file_evidence: false,
            name_only: true,
            fingerprint_match: false,
        });

        assert_eq!(filename.confidence, 60);
        assert_eq!(filename.confidence_level, ConfidenceLevel::Low);
        assert!(name_only.is_none(), "below 40 must not be returned");
    }

    #[test]
    fn caps_name_only_matches_at_55() {
        let score = score_candidate(CandidateScoreInput {
            evidence: vec![evidence("title", "Title/name similarity", 20), evidence("slug", "Slug similarity", 10), evidence("generic", "Extra weak name signal", 40)],
            has_file_metadata: false,
            has_file_evidence: false,
            name_only: true,
            fingerprint_match: false,
        })
        .expect("score");

        assert_eq!(score.confidence, 55);
        assert_eq!(score.confidence_level, ConfidenceLevel::Low);
    }

    #[test]
    fn caps_no_file_evidence_at_60() {
        let score = score_candidate(CandidateScoreInput {
            evidence: vec![evidence("title", "Title/name similarity", 20), evidence("slug", "Slug similarity", 10), evidence("author", "Author match", 5), evidence("other", "Other non-file signal", 50)],
            has_file_metadata: true,
            has_file_evidence: false,
            name_only: false,
            fingerprint_match: false,
        })
        .expect("score");

        assert_eq!(score.confidence, 60);
    }

    #[test]
    fn search_without_file_metadata_caps_at_70() {
        let score = score_candidate(CandidateScoreInput {
            evidence: vec![evidence("title", "Title/name similarity", 20), evidence("file", "Exact package/script basename match", 25), evidence("version", "Version token match", 20), evidence("slug", "Slug similarity", 10)],
            has_file_metadata: false,
            has_file_evidence: true,
            name_only: false,
            fingerprint_match: false,
        })
        .expect("score");

        assert_eq!(score.confidence, 70);
        assert_eq!(score.confidence_level, ConfidenceLevel::Medium);
    }

    #[test]
    fn negative_evidence_can_drop_below_return_threshold() {
        let score = score_candidate(CandidateScoreInput {
            evidence: vec![evidence("title", "Title/name similarity", 20), evidence("version", "Conflicting version token", -25)],
            has_file_metadata: true,
            has_file_evidence: true,
            name_only: false,
            fingerprint_match: false,
        });

        assert!(score.is_none());
    }

    #[test]
    fn sorts_candidates_by_confidence_descending() {
        let low = score_candidate(CandidateScoreInput {
            evidence: vec![evidence("title", "Title/name similarity", 45)],
            has_file_metadata: true,
            has_file_evidence: true,
            name_only: false,
            fingerprint_match: false,
        })
        .expect("low");
        let high = score_candidate(CandidateScoreInput {
            evidence: vec![evidence("fingerprint", "Exact fingerprint match", 95)],
            has_file_metadata: true,
            has_file_evidence: true,
            name_only: false,
            fingerprint_match: true,
        })
        .expect("high");

        let sorted = sort_scores(vec![low, high]);
        assert_eq!(sorted[0].confidence, 95);
        assert_eq!(sorted[1].confidence, 45);
    }
}
