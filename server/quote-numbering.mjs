/** Public website references; internal guard IDs and HBM numbering stay intact. */
export const numberingEnabled = env => env.QUOTE_SITE_NUMBERING_ENABLED === 'true';
export const numberingYear = timestamp => Number(new Intl.DateTimeFormat('en-IE', {timeZone:'Europe/Dublin',year:'numeric'}).format(new Date(timestamp)));
export async function checkNumberingSchema(db) {
  // Read-only preflight before reserving a request or contacting the provider.
  await db.prepare('SELECT year, last_sequence FROM quote_reference_counters LIMIT 0').first();
  await db.prepare('SELECT request_key, public_reference, year, sequence, accepted_at FROM quote_public_references LIMIT 0').first();
}
export async function publicReference(db, requestKey) {
  const row=await db.prepare('SELECT public_reference FROM quote_public_references WHERE request_key = ?').bind(requestKey).first();
  return row?.public_reference;
}
export async function assignPublicReference(db, requestKey, acceptedAt) {
  const timestamp=new Date(acceptedAt).getTime();
  const year=numberingYear(timestamp);
  // Only a validated, Turnstile-approved and durably reserved pending request
  // may acquire a number. D1 batch is transactional and serialises writes.
  await db.batch([
    db.prepare(`INSERT INTO quote_reference_counters (year, last_sequence)
      SELECT ?, 1
      WHERE EXISTS (SELECT 1 FROM quote_guard WHERE request_key = ? AND status = 'pending')
        AND NOT EXISTS (SELECT 1 FROM quote_public_references WHERE request_key = ?)
      ON CONFLICT(year) DO UPDATE SET last_sequence = last_sequence + 1
      WHERE NOT EXISTS (SELECT 1 FROM quote_public_references WHERE request_key = ?)`)
      .bind(year,requestKey,requestKey,requestKey),
    db.prepare(`INSERT INTO quote_public_references (request_key, public_reference, year, sequence, accepted_at)
      SELECT ?, printf('Q-SITE-%04d-%04d', year, last_sequence), year, last_sequence, ?
      FROM quote_reference_counters
      WHERE year = ?
        AND EXISTS (SELECT 1 FROM quote_guard WHERE request_key = ? AND status = 'pending')
        AND NOT EXISTS (SELECT 1 FROM quote_public_references WHERE request_key = ?)`)
      .bind(requestKey,timestamp,year,requestKey,requestKey)
  ]);
  const reference=await publicReference(db,requestKey);
  if(!reference)throw new Error('No accepted request available for website numbering.');
  return reference;
}
