/**
 * Configuration constants for the March Madness Bracket Tracker.
 */
const CONFIG = {
  YEAR: 2026,
  ESPN_GROUP_ID: '14f8ec88-78d9-4e7b-a9dc-d61047187905',

  // Point values per round
  POINTS: {
    0: 10,   // Round of 64
    1: 20,   // Round of 32
    2: 40,   // Sweet 16
    3: 80,   // Elite 8
    4: 160,  // Final Four
    5: 320,  // Championship
  },

  ROUND_NAMES: ['Round of 64', 'Round of 32', 'Sweet 16', 'Elite 8', 'Final Four', 'Championship'],

  REGIONS: ['South', 'East', 'Midwest', 'West'],

  // ESPN bracket pick string: 63 games total
  // Games 0-31:  Round of 64 (8 per region)
  // Games 32-47: Round of 32 (4 per region)
  // Games 48-55: Sweet 16   (2 per region)
  // Games 56-59: Elite 8    (1 per region)
  // Games 60-61: Final Four
  // Game  62:    Championship
  ROUND_SLICES: [
    { start: 0,  count: 32 }, // R64
    { start: 32, count: 16 }, // R32
    { start: 48, count: 8 },  // S16
    { start: 56, count: 4 },  // E8
    { start: 60, count: 2 },  // F4
    { start: 62, count: 1 },  // Championship
  ],

  GAMES_PER_REGION: [8, 4, 2, 1], // R64 through E8

  // ESPN APIs
  ESPN_SCOREBOARD_URL: 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard',
  ESPN_BRACKET_API: '/api/espn-group', // Vercel serverless proxy

  REFRESH_INTERVAL: 30000, // 30 seconds for live score refresh
};
