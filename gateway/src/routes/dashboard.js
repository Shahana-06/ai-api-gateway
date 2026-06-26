/**
 * routes/dashboard.js
 *
 * GET /dashboard      — serves the HTML page
 * GET /api/dashboard/stats — returns JSON metrics from Postgres
 */

const express  = require('express');
const router   = express.Router();
const { pool } = require('../config/database');
const path     = require('path');

// ─── JSON metrics endpoint ────────────────────────────────────────────────────
router.get('/api/dashboard/stats', async (req, res) => {
  const [totalResult, latencyResult, errorResult, tokenResult, intentResult] =
    await Promise.all([

      // Total requests in last 24h
      pool.query(`
        SELECT count(*)::int as total
        FROM request_logs
        WHERE created_at > now() - interval '24 hours'
      `),

      // p95 latency per route in last 1h
      pool.query(`
        SELECT
          route,
          percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms)::int as p95_ms,
          count(*)::int as count
        FROM request_logs
        WHERE created_at > now() - interval '1 hour'
          AND route IS NOT NULL
        GROUP BY route
        ORDER BY count DESC
      `),

      // Error rate in last 1h
      pool.query(`
        SELECT
          count(*)::int as total,
          count(*) FILTER (WHERE status_code >= 400)::int as errors
        FROM request_logs
        WHERE created_at > now() - interval '1 hour'
      `),

      // Total tokens used in last 24h
      pool.query(`
        SELECT coalesce(sum(token_count), 0)::int as total_tokens
        FROM request_logs
        WHERE created_at > now() - interval '24 hours'
      `),

      // Top intents in last 1h
      pool.query(`
        SELECT intent, count(*)::int as count
        FROM request_logs
        WHERE created_at > now() - interval '1 hour'
          AND intent IS NOT NULL
        GROUP BY intent
        ORDER BY count DESC
        LIMIT 5
      `),
    ]);

  const errorRow   = errorResult.rows[0];
  const errorRate  = errorRow.total > 0
    ? ((errorRow.errors / errorRow.total) * 100).toFixed(1)
    : '0.0';

  res.json({
    total_requests_24h: totalResult.rows[0].total,
    error_rate_1h:      `${errorRate}%`,
    total_tokens_24h:   tokenResult.rows[0].total_tokens,
    latency_by_route:   latencyResult.rows,
    top_intents_1h:     intentResult.rows,
    generated_at:       new Date().toISOString(),
  });
});

// ─── HTML dashboard ───────────────────────────────────────────────────────────
router.get('/dashboard', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Gateway — Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, sans-serif; background: #0f172a; color: #e2e8f0; padding: 24px; }
    h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 24px; color: #f8fafc; }
    h1 span { color: #6366f1; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .card { background: #1e293b; border-radius: 12px; padding: 20px; border: 1px solid #334155; }
    .card .label { font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
    .card .value { font-size: 2rem; font-weight: 700; color: #f8fafc; }
    .card .value.green { color: #4ade80; }
    .card .value.yellow { color: #facc15; }
    .card .value.red { color: #f87171; }
    .charts { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .chart-card { background: #1e293b; border-radius: 12px; padding: 20px; border: 1px solid #334155; }
    .chart-card h2 { font-size: 0.875rem; color: #94a3b8; margin-bottom: 16px; text-transform: uppercase; }
    .status { font-size: 0.75rem; color: #64748b; margin-top: 16px; text-align: right; }
    table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    td, th { padding: 8px 12px; text-align: left; border-bottom: 1px solid #334155; }
    th { color: #64748b; font-weight: 500; }
    td { color: #e2e8f0; }
  </style>
</head>
<body>
  <h1>AI Gateway <span>Dashboard</span></h1>

  <div class="grid">
    <div class="card">
      <div class="label">Total Requests (24h)</div>
      <div class="value" id="total-requests">—</div>
    </div>
    <div class="card">
      <div class="label">Error Rate (1h)</div>
      <div class="value" id="error-rate">—</div>
    </div>
    <div class="card">
      <div class="label">Tokens Used (24h)</div>
      <div class="value" id="total-tokens">—</div>
    </div>
    <div class="card">
      <div class="label">Last Updated</div>
      <div class="value" style="font-size:1rem;color:#94a3b8" id="last-updated">—</div>
    </div>
  </div>

  <div class="charts">
    <div class="chart-card">
      <h2>p95 Latency by Route (1h)</h2>
      <canvas id="latencyChart"></canvas>
    </div>
    <div class="chart-card">
      <h2>Top Intents (1h)</h2>
      <table id="intents-table">
        <thead><tr><th>Intent</th><th>Requests</th></tr></thead>
        <tbody id="intents-body"></tbody>
      </table>
    </div>
  </div>

  <div class="status" id="status">Connecting...</div>

<script>
  let chart = null;

  async function fetchStats() {
    try {
      const res  = await fetch('/api/dashboard/stats');
      const data = await res.json();

      // Stat cards
      document.getElementById('total-requests').textContent = data.total_requests_24h.toLocaleString();
      document.getElementById('total-tokens').textContent   = data.total_tokens_24h.toLocaleString();

      const errEl  = document.getElementById('error-rate');
      errEl.textContent  = data.error_rate_1h;
      const errNum = parseFloat(data.error_rate_1h);
      errEl.className    = 'value ' + (errNum === 0 ? 'green' : errNum < 5 ? 'yellow' : 'red');

      document.getElementById('last-updated').textContent =
        new Date(data.generated_at).toLocaleTimeString();

      // Latency chart
      const labels = data.latency_by_route.map(r => r.route.replace('http://localhost:', ':'));
      const values = data.latency_by_route.map(r => r.p95_ms);

      if (chart) {
        chart.data.labels       = labels;
        chart.data.datasets[0].data = values;
        chart.update();
      } else {
        const ctx = document.getElementById('latencyChart').getContext('2d');
        chart = new Chart(ctx, {
          type: 'bar',
          data: {
            labels,
            datasets: [{
              label: 'p95 latency (ms)',
              data: values,
              backgroundColor: '#6366f1',
              borderRadius: 6,
            }]
          },
          options: {
            plugins: { legend: { display: false } },
            scales: {
              x: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } },
              y: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } }
            }
          }
        });
      }

      // Intents table
      const tbody = document.getElementById('intents-body');
      tbody.innerHTML = data.top_intents_1h.length === 0
        ? '<tr><td colspan="2" style="color:#64748b">No data yet</td></tr>'
        : data.top_intents_1h.map(r =>
            \`<tr><td>\${r.intent}</td><td>\${r.count}</td></tr>\`
          ).join('');

      document.getElementById('status').textContent =
        'Live — refreshes every 5s';

    } catch (e) {
      document.getElementById('status').textContent = 'Error fetching data';
    }
  }

  fetchStats();
  setInterval(fetchStats, 5000);
</script>
</body>
</html>`);
});

module.exports = router;