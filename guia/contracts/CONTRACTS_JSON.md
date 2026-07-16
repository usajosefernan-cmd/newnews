# CONTRATOS JSON NEWNEWS ENGINE

## Base item

```json
{
  "id": "",
  "source_type": "url|text|image|video|rss|social|manual",
  "source_url": "",
  "raw_text": "",
  "platform": "",
  "detected_at": "",
  "metadata": {}
}
```

## Base phase output

```json
{
  "phase": "",
  "input_id": "",
  "ok": true,
  "result": {},
  "warnings": [],
  "errors": [],
  "cost_estimate": null,
  "next_action": ""
}
```

## Hot topic output

```json
{
  "topic_id": "",
  "slug": "",
  "title": "",
  "public_concern_summary": "",
  "why_it_matters": "",
  "main_confusions": [],
  "source_map_status": "",
  "priority_score": 0,
  "social_heat_score": 0,
  "risk_score": 0,
  "evergreen_score": 0,
  "needs_new_vertical": true,
  "merge_with_existing_topic": null
}
```

## Relevance gate output

```json
{
  "should_process": true,
  "reason": "",
  "priority": "alta|media|baja|descartar",
  "public_interest_score": 0,
  "virality_score": 0,
  "harm_score": 0,
  "verification_value_score": 0,
  "commercial_noise_score": 0,
  "recommended_action": "process|queue|ignore|monitor_only"
}
```

## Semantic router output

```json
{
  "content_type": "",
  "claim_type": "",
  "topic_match": {
    "existing_topic_id": "",
    "confidence": 0,
    "should_merge": true
  },
  "category_tags": [],
  "needs_new_topic": false,
  "routing_reason": ""
}
```

## Source strategy output

```json
{
  "source_strategy": {
    "required_source_types": [],
    "preferred_authority_level": "",
    "minimum_sources": 0,
    "needs_original_source": true,
    "needs_context_source": true,
    "needs_counter_source": false,
    "manual_check_required": false
  },
  "search_queries": [],
  "reuse_from_cache": true,
  "reason": ""
}
```

## Verifier output

```json
{
  "verdict": "verdadero|falso|engañoso|falta_contexto|sin_pruebas|no_verificable",
  "confidence": 0,
  "what_is_true": [],
  "what_is_false": [],
  "what_lacks_context": [],
  "what_is_unknown": [],
  "key_sources": [],
  "human_review_required": true
}
```


# CONTRATOS NEWNEWS LIVE

## Live session

```json
{
  "id": "",
  "mode": "direct|meeting|bank|insurance|legal|commercial|custom",
  "voice_mode": "silent|wake_only|alerts|full_assistant",
  "status": "created|ready|running|paused|stopped|error|deleted",
  "source_type": "text|microphone|tab_capture|captions|embed|manual",
  "source_url": "",
  "provider": "",
  "model": "",
  "save_audio": false,
  "save_transcript": false,
  "consent_id": "",
  "cost_estimate": 0,
  "created_at": "",
  "ended_at": ""
}
```

## Live event envelope

```json
{
  "event_id": "",
  "type": "transcript.final",
  "session_id": "",
  "sequence": 1,
  "occurred_at": "",
  "source": "",
  "schema_version": "1",
  "correlation_id": "",
  "payload": {}
}
```

## Transcript segment

```json
{
  "segment_id": "",
  "session_id": "",
  "kind": "partial|final",
  "start_time": 0,
  "end_time": 0,
  "media_time": 0,
  "speaker_label": "",
  "text": "",
  "confidence": null,
  "language": "",
  "revision_of": null
}
```

## Live claim

```json
{
  "claim_id": "",
  "session_id": "",
  "source_segment_ids": [],
  "claim_text": "",
  "normalized_claim": "",
  "category": "",
  "risk_score": 0,
  "relevance_score": 0,
  "cache_status": "unknown|hit|miss",
  "verification_status": "detected|cached|requires_source|pending|sent_to_review|discarded",
  "timestamp": 0
}
```

## Live card

```json
{
  "card_id": "",
  "session_id": "",
  "claim_id": "",
  "card_type": "claim|context|source|question|risk|cache|summary",
  "title": "",
  "content": "",
  "severity": "info|low|medium|high|critical",
  "labels": [],
  "provisional": true,
  "created_at": ""
}
```

## Voice response decision

```json
{
  "session_id": "",
  "trigger_event_id": "",
  "mode": "wake_only",
  "response_text": "",
  "should_speak": true,
  "reason": "",
  "expires_at": ""
}
```

## Send to review

```json
{
  "session_id": "",
  "claim_id": "",
  "timestamp": 0,
  "source_url": "",
  "claim_text": "",
  "context_window": "",
  "risk_score": 0,
  "suggested_sources": [],
  "cards": [],
  "requested_by": "",
  "publish": false
}
```
