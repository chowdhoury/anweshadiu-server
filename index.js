const express = require("express");
const app = express();
const port = 3000;

const aboutRoutes = require("./routes/about");

app.get("/", (req, res) => {
  const uptime = process.uptime();
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);

  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Anwesha API</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #0f0f1a;
      color: #e0e0e0;
      min-height: 100vh;
      overflow-x: hidden;
    }

    .bg-glow {
      position: fixed;
      width: 600px; height: 600px;
      border-radius: 50%;
      filter: blur(120px);
      opacity: 0.15;
      pointer-events: none;
      z-index: 0;
    }
    .glow-1 { top: -200px; left: -100px; background: #6366f1; }
    .glow-2 { bottom: -200px; right: -100px; background: #06b6d4; }

    .container {
      max-width: 900px;
      margin: 0 auto;
      padding: 2rem 1.5rem;
      position: relative;
      z-index: 1;
    }

    /* --- Header --- */
    header {
      text-align: center;
      padding: 4rem 0 2rem;
    }
    .logo {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 72px; height: 72px;
      border-radius: 18px;
      background: linear-gradient(135deg, #6366f1, #06b6d4);
      margin-bottom: 1.5rem;
      font-size: 1.8rem;
      font-weight: 700;
      color: #fff;
      box-shadow: 0 8px 32px rgba(99,102,241,0.35);
    }
    header h1 {
      font-size: 2.5rem;
      font-weight: 700;
      background: linear-gradient(135deg, #c7d2fe, #a5f3fc);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 0.5rem;
    }
    header p {
      color: #94a3b8;
      font-size: 1.1rem;
      font-weight: 300;
    }

    /* --- Status bar --- */
    .status-bar {
      display: flex;
      justify-content: center;
      gap: 2rem;
      margin: 2rem 0 3rem;
      flex-wrap: wrap;
    }
    .status-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.9rem;
      color: #94a3b8;
    }
    .dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: #22c55e;
      box-shadow: 0 0 8px #22c55e;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    .badge {
      background: rgba(99,102,241,0.15);
      color: #a5b4fc;
      padding: 0.2rem 0.6rem;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 500;
    }

    /* --- Section --- */
    .section-title {
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #6366f1;
      margin-bottom: 1rem;
    }

    /* --- Endpoint Cards --- */
    .endpoints {
      display: grid;
      gap: 1rem;
      margin-bottom: 3rem;
    }
    .endpoint {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 14px;
      padding: 1.25rem 1.5rem;
      display: flex;
      align-items: center;
      gap: 1rem;
      transition: all 0.25s ease;
      cursor: default;
    }
    .endpoint:hover {
      background: rgba(255,255,255,0.07);
      border-color: rgba(99,102,241,0.3);
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    }
    .method {
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.3rem 0.65rem;
      border-radius: 6px;
      min-width: 52px;
      text-align: center;
      letter-spacing: 0.03em;
    }
    .method-get  { background: rgba(34,197,94,0.15);  color: #4ade80; }
    .method-post { background: rgba(59,130,246,0.15); color: #60a5fa; }
    .path {
      font-family: 'Courier New', monospace;
      font-size: 0.95rem;
      color: #e2e8f0;
      font-weight: 500;
    }
    .desc {
      color: #64748b;
      font-size: 0.85rem;
      margin-left: auto;
    }

    /* --- Info cards --- */
    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1rem;
      margin-bottom: 3rem;
    }
    .info-card {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 14px;
      padding: 1.5rem;
    }
    .info-card h3 {
      font-size: 0.85rem;
      color: #64748b;
      font-weight: 500;
      margin-bottom: 0.5rem;
    }
    .info-card .value {
      font-size: 1.5rem;
      font-weight: 600;
      background: linear-gradient(135deg, #c7d2fe, #a5f3fc);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    /* --- Footer --- */
    footer {
      text-align: center;
      padding: 2rem 0;
      color: #334155;
      font-size: 0.8rem;
      border-top: 1px solid rgba(255,255,255,0.04);
    }
    footer a {
      color: #6366f1;
      text-decoration: none;
    }

    @media (max-width: 600px) {
      header h1 { font-size: 1.8rem; }
      .endpoint { flex-wrap: wrap; }
      .desc { margin-left: 0; width: 100%; }
    }
  </style>
</head>
<body>
  <div class="bg-glow glow-1"></div>
  <div class="bg-glow glow-2"></div>

  <div class="container">
    <header>
      <div class="logo">A</div>
      <h1>Anwesha API</h1>
      <p>Backend service — fast, modern &amp; ready to go</p>
    </header>

    <div class="status-bar">
      <div class="status-item">
        <span class="dot"></span> Server Online
      </div>
      <div class="status-item">
        <span class="badge">v1.0.0</span>
      </div>
      <div class="status-item">
        Uptime: ${hours}h ${minutes}m ${seconds}s
      </div>
    </div>

    

    <div class="section-title">Server Info</div>
    <div class="info-grid">
      <div class="info-card">
        <h3>Environment</h3>
        <div class="value">Development</div>
      </div>
      <div class="info-card">
        <h3>Port</h3>
        <div class="value">${port}</div>
      </div>
      <div class="info-card">
        <h3>Node.js</h3>
        <div class="value">${process.version}</div>
      </div>
    </div>

    <footer>
      &copy; 2026 Anwesha &mdash; Built with
      <a href="https://expressjs.com" target="_blank">Express</a>
    </footer>
  </div>
</body>
</html>
  `);
});

app.use("/about", aboutRoutes);

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
