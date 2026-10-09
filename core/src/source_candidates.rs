use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SourceProviderId {
    Curseforge,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ConfidenceLevel {
    High,
    Medium,
    Low,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceEvidence {
    pub kind: String,
    pub description: String,
    pub weight: i16,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceCandidate {
    pub provider_id: SourceProviderId,
    pub title: String,
    pub source_url: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preview_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub author: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project_id: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub file_id: Option<u64>,
    pub confidence: u8,
    pub confidence_level: ConfidenceLevel,
    pub reasons: Vec<String>,
    pub evidence: Vec<SourceEvidence>,
}

impl ConfidenceLevel {
    pub fn from_score(score: u8) -> Option<Self> {
        match score {
            85..=100 => Some(Self::High),
            70..=84 => Some(Self::Medium),
            40..=69 => Some(Self::Low),
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn confidence_level_maps_scores() {
        assert_eq!(ConfidenceLevel::from_score(100), Some(ConfidenceLevel::High));
        assert_eq!(ConfidenceLevel::from_score(85), Some(ConfidenceLevel::High));
        assert_eq!(ConfidenceLevel::from_score(84), Some(ConfidenceLevel::Medium));
        assert_eq!(ConfidenceLevel::from_score(70), Some(ConfidenceLevel::Medium));
        assert_eq!(ConfidenceLevel::from_score(69), Some(ConfidenceLevel::Low));
        assert_eq!(ConfidenceLevel::from_score(40), Some(ConfidenceLevel::Low));
        assert_eq!(ConfidenceLevel::from_score(39), None);
    }

    #[test]
    fn source_candidate_serializes_frontend_contract() {
        let candidate = SourceCandidate {
            provider_id: SourceProviderId::Curseforge,
            title: "MC Command Center".to_string(),
            source_url: "https://www.curseforge.com/sims4/mods/mc-command-center".to_string(),
            preview_url: Some("https://media.forgecdn.net/cover.png".to_string()),
            author: Some("Deaderpool".to_string()),
            project_id: Some(551680),
            file_id: Some(67890),
            confidence: 95,
            confidence_level: ConfidenceLevel::High,
            reasons: vec!["Exact fingerprint match".to_string()],
            evidence: vec![SourceEvidence {
                kind: "fingerprint".to_string(),
                description: "Exact fingerprint match".to_string(),
                weight: 95,
            }],
        };

        let json = serde_json::to_value(candidate).expect("serialize");
        assert_eq!(json["providerId"], "curseforge");
        assert_eq!(json["confidenceLevel"], "high");
        assert_eq!(json["projectId"], 551680);
        assert_eq!(json["evidence"][0]["weight"], 95);
    }
}
