# Website Enquiry / HBM Intake v1

Server-owned contract, not a public generic write API. buildEnquiry runs only after existing validation, pricing and Turnstile. source_id comes from deployment configuration, never browser workspace input. idempotency_key is an HMAC of requestId. external_reference starts null and is assigned by the unchanged Q-SITE allocator; it is NOT an official HBM Quote number.

Fields: schema_version=1; source_id; idempotency_key; external_reference; contacts (name,phone,email,eircode); description; materials_information; availability_preferences; services (id,quantity,materials,options); area; estimate_snapshot; pricing_catalogue_version; provenance (kind,origin,received_at,privacy_consent,privacy_notice_version).

Canonical serialization sorts object keys and preserves array order. Monetary values and unknown amounts retain the existing authoritative calculator representation. Preferences are not booked Visits. Estimate is not an agreed price. All input bounds and supported options remain enforced by quote.validate/calculate. Tokens, cookies, raw IP, provider responses and arbitrary HTTP fields are excluded.

Receipts use (source_id,idempotency_key) plus an HMAC digest. Same identity/different digest is a conflict. The request identity outlives 24h abuse metadata. A future HBM endpoint must authenticate the source and map its workspace server-side. Initial transport has no client account or production activation.
