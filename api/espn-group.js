/**
 * Vercel Serverless Function — CORS proxy for ESPN Tournament Challenge API.
 *
 * Fetches the challenge config (all 6 rounds of propositions) and group data.
 *
 * Usage: GET /api/espn-group?groupID=xxx&challengeKey=tournament-challenge-bracket-2026
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { groupID, challengeKey } = req.query;
  if (!groupID) {
    return res.status(400).json({ error: 'Missing groupID parameter' });
  }

  const key = challengeKey || 'tournament-challenge-bracket-2026';
  const BASE = 'https://gambit-api.fantasy.espn.com/apis/v1';
  const headers = {
    'User-Agent': 'Mozilla/5.0 (compatible; BracketTracker/1.0)',
    'Accept': 'application/json',
  };

  try {
    // Step 1: Get challenge config (includes R64 propositions + challengeId)
    const configResp = await fetch(`${BASE}/challenges/${key}`, { headers });
    if (!configResp.ok) {
      const text = await configResp.text();
      return res.status(configResp.status).json({
        error: `ESPN challenge config returned ${configResp.status}`,
        detail: text.slice(0, 500),
      });
    }
    const challenge = await configResp.json();
    const challengeId = challenge.id;

    // Step 2: Fetch group data + later-round propositions in parallel
    const [groupResp, ...periodResults] = await Promise.all([
      fetch(`${BASE}/challenges/${challengeId}/groups/${encodeURIComponent(groupID)}`, { headers }),
      ...[2, 3, 4, 5, 6].map(period =>
        fetch(`${BASE}/challenges/${key}?scoringPeriodId=${period}`, { headers })
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      ),
    ]);

    if (!groupResp.ok) {
      const text = await groupResp.text();
      return res.status(groupResp.status).json({
        error: `ESPN group data returned ${groupResp.status}`,
        detail: text.slice(0, 500),
      });
    }
    const group = await groupResp.json();

    // Combine all propositions from all rounds
    const allPropositions = [...(challenge.propositions || [])];
    for (const periodData of periodResults) {
      if (periodData && periodData.propositions) {
        allPropositions.push(...periodData.propositions);
      }
    }
    challenge.allPropositions = allPropositions;

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({ challenge, group });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch from ESPN', detail: err.message });
  }
}
