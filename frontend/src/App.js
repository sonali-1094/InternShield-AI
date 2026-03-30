import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const screens = [
  ['dashboard', '📊', 'Dashboard'],
  ['offer', '📄', 'Analyze Offer'],
  ['message', '📝', 'Check Message'],
  ['company', '🏢', 'Company Check'],
];

const offerSample = `Dear Candidate,

Congratulations! You have been selected for an internship at Bright Future Solutions.
No interview is required. To confirm your seat, pay a registration fee of Rs 2,999 today.
Limited seats available. Immediate joining.

Regards,
HR Team`;

const messageSample = `Hello Applicant,

We found your profile for a remote internship. The stipend is up to 45,000 per month.
Please reply quickly and share your Aadhaar card for processing. Contact us on Telegram.

Thanks,
Recruitment Desk`;

function parseStructuredResult(raw) {
  if (!raw || raw.startsWith('Error:')) return null;
  const normalized = raw.replace(/\*\*/g, '');
  const section = (title, next) => {
    const pattern = new RegExp(`${title}:\\s*([\\s\\S]*?)(?=\\n(?:${next.join('|')}):|$)`, 'i');
    return normalized.match(pattern)?.[1]?.trim() || '';
  };
  return {
    status: normalized.match(/Status:\s*(SAFE|SUSPICIOUS|SCAM)/i)?.[1]?.toUpperCase() || '',
    trustScore: Number(normalized.match(/Trust Score:\s*(\d{1,3})\s*\/\s*100/i)?.[1] || 0),
    redFlags: section('Red Flags', ['Explanation', 'Recommendation', 'Advice', 'Note']),
    explanation: section('Explanation', ['Recommendation', 'Advice', 'Note']),
    recommendation: section('Recommendation', ['Advice', 'Note']),
    advice: section('Advice', ['Note']),
    note: section('Note', []),
  };
}

function metaFor(status) {
  if (status === 'SAFE') return { badge: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300', panel: 'border-emerald-400/30 bg-emerald-500/10', accent: '#22C55E', title: 'Safe', risk: 'Low Risk', icon: '🛡️' };
  if (status === 'SUSPICIOUS') return { badge: 'border-amber-400/30 bg-amber-500/10 text-amber-300', panel: 'border-amber-400/30 bg-amber-500/10', accent: '#F59E0B', title: 'Suspicious', risk: 'Medium Risk', icon: '⚠️' };
  if (status === 'SCAM') return { badge: 'border-rose-400/30 bg-rose-500/10 text-rose-300', panel: 'border-rose-400/30 bg-rose-500/10', accent: '#EF4444', title: 'Scam Detected', risk: 'High Risk', icon: '🚨' };
  return { badge: 'border-sky-400/30 bg-sky-500/10 text-sky-300', panel: 'border-slate-700 bg-slate-900/70', accent: '#38BDF8', title: 'Pending', risk: 'Awaiting Analysis', icon: '🧠' };
}

function listItems(text) {
  if (!text) return [];
  return text.split('\n').map((item) => item.replace(/^[•*-]\s*/, '').trim()).filter(Boolean);
}

function scoreFromResult(result) {
  return parseStructuredResult(result)?.trustScore ?? null;
}

function computeFinalScore({ offerScore, messageScore, companyScore }) {
  if (![offerScore, messageScore, companyScore].every((score) => Number.isFinite(score))) {
    return null;
  }
  return Math.round((offerScore * 0.5) + (messageScore * 0.2) + (companyScore * 0.3));
}

function Gauge({ score, status }) {
  const meta = metaFor(status);
  const value = Number.isFinite(score) ? score : 0;
  const circumference = 2 * Math.PI * 52;
  return (
    <div className="relative flex h-40 w-40 items-center justify-center">
      <svg viewBox="0 0 140 140" className="h-40 w-40 -rotate-90">
        <circle cx="70" cy="70" r="52" fill="none" stroke="rgba(148,163,184,.16)" strokeWidth="10" />
        <circle cx="70" cy="70" r="52" fill="none" stroke={meta.accent} strokeWidth="10" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference - (value / 100) * circumference} />
      </svg>
      <div className="absolute text-center">
        <div className="text-4xl font-black text-white">{value}%</div>
        <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Trust Score</div>
      </div>
    </div>
  );
}

function TrustMeterCard({ score, status, finalScore }) {
  const meta = metaFor(status);
  return (
    <div className="dashboard-card min-h-[320px]">
      <div className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-300">Trust Score Meter</div>
      <div className="mt-6 flex flex-col items-center text-center">
        <Gauge score={score} status={status} />
        <div className={`mt-5 inline-flex rounded-full border px-4 py-2 text-sm font-semibold ${meta.badge}`}>{meta.icon} {meta.risk}</div>
        <div className="mt-4 text-3xl font-black text-white">{score}/100</div>
        <div className="mt-2 text-sm text-slate-400">Live trust meter based on your latest analysis result.</div>
        <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
          Combined Score: <span className="font-semibold text-white">{finalScore ?? '--'}/100</span>
        </div>
      </div>
    </div>
  );
}

function Panel({ title, subtitle, action, children }) {
  return (
    <section className="glass-panel rounded-[28px] p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.26em] text-sky-300/80">{title}</div>
          {subtitle && <div className="mt-2 text-sm leading-6 text-slate-400">{subtitle}</div>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ChecklistCard({ checklist }) {
  if (!checklist?.length) return null;
  const priorityStyles = {
    critical: 'border-rose-400/30 bg-rose-500/10 text-rose-200',
    high: 'border-amber-400/30 bg-amber-500/10 text-amber-200',
    medium: 'border-sky-400/30 bg-sky-500/10 text-sky-200',
  };
  return (
    <div className="dashboard-card">
      <div className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-300">Startup Verification Checklist</div>
      <div className="mt-5 space-y-3">
        {checklist.map((item) => (
          <div key={item.id} className="rounded-3xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="font-semibold text-white">{item.title}</div>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase ${priorityStyles[item.priority] || priorityStyles.medium}`}>{item.priority}</span>
            </div>
            <div className="mt-3 text-sm leading-6 text-slate-300">{item.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultCard({ result, source, checklist, analysisId, summary }) {
  const parsed = parseStructuredResult(result);
  const trustScore = summary?.trustScore ?? parsed?.trustScore ?? 0;
  const status = summary?.status || parsed?.status || '';
  if (!result) {
    return (
      <div className="dashboard-card flex min-h-[420px] flex-col justify-between">
        <div>
          <div className="inline-flex rounded-full border border-sky-400/20 bg-sky-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-sky-300">
            Your AI Safety Assistant for Internship Applications
          </div>
          <h3 className="mt-6 text-3xl font-black text-white">The result card appears here.</h3>
          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-400">
            Every scan is now auto-saved into a product-style evidence timeline with trust analytics and a verification checklist.
          </p>
        </div>
      </div>
    );
  }
  if (result.startsWith('Error:')) {
    return <div className="result-panel border-rose-500/30 bg-rose-500/10 text-sm text-rose-100">{result}</div>;
  }
  const meta = metaFor(status);
  const flags = listItems(parsed?.redFlags);
  return (
    <div className="space-y-5 animate-rise">
      {source === 'fallback' && <div className="rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">Using fallback detection because the live AI analysis is unavailable.</div>}
      {analysisId && <div className="rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-200">Auto-saved to startup timeline as {analysisId}</div>}
      <div className={`result-panel ${meta.panel}`}>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${meta.badge}`}>{meta.icon} {meta.title}</div>
            <h3 className="mt-5 text-4xl font-black text-white">{meta.title === 'Scam Detected' ? 'SCAM DETECTED' : meta.title.toUpperCase()}</h3>
            <div className="mt-3 text-lg font-semibold text-slate-200">Trust Score: {trustScore}/100</div>
            <div className="mt-2 text-sm uppercase tracking-[0.24em] text-slate-400">{meta.risk}</div>
          </div>
          <Gauge score={trustScore} status={status} />
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-5">
          <div className="dashboard-card">
            <div className="text-sm font-semibold uppercase tracking-[0.24em] text-rose-300">🚨 Red Flags</div>
            <div className="mt-5 space-y-3">
              {(flags.length ? flags : ['No specific red flags were extracted.']).map((flag) => (
                <div key={flag} className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-200">{flag}</div>
              ))}
            </div>
          </div>
          <ChecklistCard checklist={checklist} />
        </div>
        <div className="space-y-5">
          <div className="dashboard-card">
            <div className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-300">🧠 Explanation</div>
            <div className="mt-4 text-sm leading-7 text-slate-300">{parsed?.explanation || 'This content was analyzed for scam patterns, urgency, fees, and identity risks.'}</div>
          </div>
          <div className="dashboard-card">
            <div className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-300">💡 Advice</div>
            <div className="mt-4 text-sm leading-7 text-slate-300">{parsed?.advice || parsed?.recommendation || 'Verify the recruiter email, company domain, and offer terms before proceeding.'}</div>
            {parsed?.note && <div className="mt-3 text-xs leading-6 text-slate-500">{parsed.note}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function CompanyCard({ data, finalScore }) {
  if (!data) return <div className="dashboard-card min-h-[320px]"><div className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-300">Company Intelligence</div><div className="mt-4 text-sm leading-7 text-slate-400">Search a company name to verify simulated MCA registration, risk level, and company trust impact.</div></div>;
  const riskStatus = data.registered ? 'SAFE' : 'SCAM';
  const meta = metaFor(riskStatus);
  return (
    <div className={`result-panel ${meta.panel} animate-rise`}>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className={`inline-flex rounded-full border px-4 py-2 text-sm font-semibold ${meta.badge}`}>{meta.icon} {meta.title}</div>
          <h3 className="mt-5 text-3xl font-black text-white">{data.company}</h3>
          <div className="mt-3 text-lg font-semibold text-slate-200">{data.registered ? '✅ Registered / MCA Verified' : '❌ Not Found in MCA'}</div>
          <div className="mt-2 text-slate-300">📊 Trust Score: {data.trustScore}/100</div>
          <div className="mt-2 text-sm uppercase tracking-[0.24em] text-slate-400">🚨 Risk Level: {data.riskLevel}</div>
        </div>
        <Gauge score={data.trustScore} status={riskStatus} />
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="dashboard-card">
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-300">🧠 Insight</div>
          <div className="mt-4 text-sm leading-7 text-slate-300">{data.insight}</div>
          <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">Source: {data.verificationSource}</div>
        </div>
        <div className="dashboard-card">
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-300">💡 Advice</div>
          <div className="mt-4 text-sm leading-7 text-slate-300">{data.advice}</div>
          <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-200">{data.message}</div>
        </div>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="dashboard-card">
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-300">Government Verification</div>
          <div className="mt-4 text-2xl font-black text-white">{data.status}</div>
          <div className="mt-3 text-sm leading-7 text-slate-400">We verify companies using official government databases like MCA to ensure authenticity.</div>
        </div>
        <div className="dashboard-card">
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-300">Combined Trust Score</div>
          <div className="mt-4 text-3xl font-black text-white">{finalScore ?? '--'}/100</div>
          <div className="mt-3 text-sm leading-7 text-slate-400">
            {finalScore !== null
              ? 'Calculated as offer 50% + message 20% + company verification 30%.'
              : 'Run an offer analysis, message analysis, and company verification to compute the final score.'}
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [screen, setScreen] = useState('dashboard');
  const [offerText, setOfferText] = useState(offerSample);
  const [messageText, setMessageText] = useState(messageSample);
  const [file, setFile] = useState(null);
  const [offerState, setOfferState] = useState({ result: '', source: '', checklist: [], analysisId: '', summary: null });
  const [messageState, setMessageState] = useState({ result: '', source: '', checklist: [], analysisId: '', summary: null });
  const [loading, setLoading] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyResult, setCompanyResult] = useState(null);
  const [companyError, setCompanyError] = useState('');
  const [recent, setRecent] = useState([]);
  const [insights, setInsights] = useState({ metrics: { totalScans: 0, scamDetected: 0, safeResults: 0, avgTrustScore: 0 }, recentTrend: [], topPatterns: [], sourceMix: { openai: 0, groq: 0, fallback: 0 } });

  const offerScore = useMemo(() => offerState.summary?.trustScore ?? scoreFromResult(offerState.result), [offerState]);
  const messageScore = useMemo(() => messageState.summary?.trustScore ?? scoreFromResult(messageState.result), [messageState]);
  const finalScore = useMemo(
    () => computeFinalScore({ offerScore, messageScore, companyScore: companyResult?.trustScore ?? null }),
    [offerScore, messageScore, companyResult]
  );
  const dashboardScore = insights.recentTrend.at(-1)?.score || insights.metrics.avgTrustScore || 0;
  const dashboardStatus = insights.recentTrend.at(-1)?.status || (dashboardScore < 45 ? 'SCAM' : dashboardScore < 70 ? 'SUSPICIOUS' : 'SAFE');

  const loadStartupData = useCallback(async () => {
    try {
      const [analysesRes, insightsRes] = await Promise.all([
        axios.get('http://localhost:5000/api/analyses'),
        axios.get('http://localhost:5000/api/insights'),
      ]);
      setRecent(analysesRes.data || []);
      setInsights(
        insightsRes.data || {
          metrics: { totalScans: 0, scamDetected: 0, safeResults: 0, avgTrustScore: 0 },
          recentTrend: [],
          topPatterns: [],
          sourceMix: { openai: 0, groq: 0, fallback: 0 },
        }
      );
    } catch (err) {
      console.error('Failed to load startup data', err);
    }
  }, []);

  useEffect(() => {
    loadStartupData();
  }, [loadStartupData]);

  const analyze = async ({ text, selectedFile, updateState, type }) => {
    setLoading(type);
    updateState({ result: '', source: '', checklist: [], analysisId: '', summary: null });
    const formData = new FormData();
    if (text) formData.append('text', text);
    if (selectedFile) formData.append('file', selectedFile);
    try {
      const res = await axios.post('http://localhost:5000/api/analyze', formData);
      updateState({
        result: res.data.result,
        source: res.data.source || '',
        checklist: res.data.checklist || [],
        analysisId: res.data.analysisId || '',
        summary: res.data.summary || null,
      });
      await loadStartupData();
    } catch (err) {
      const message = err.response?.data?.error || err.message || 'Error analyzing content. Please check your backend setup and try again.';
      updateState({ result: `Error: ${message}`, source: '', checklist: [], analysisId: '', summary: null });
    } finally {
      setLoading('');
    }
  };

  const checkCompany = async () => {
    const trimmedCompany = companyName.trim();
    if (!trimmedCompany) return;

    setLoading('Company Check');
    setCompanyError('');
    setCompanyResult(null);

    try {
      const res = await axios.post('http://localhost:5000/check-company', {
        company: trimmedCompany,
      });
      setCompanyResult(res.data);
    } catch (err) {
      setCompanyError(err.response?.data?.error || err.message || 'Failed to verify company.');
    } finally {
      setLoading('');
    }
  };

  const topPatternPreview = useMemo(() => insights.topPatterns.slice(0, 3), [insights.topPatterns]);

  return (
    <div className="min-h-screen bg-obsidian text-slate-100">
      <div className="fixed inset-0 overflow-hidden">
        <div className="absolute left-[-12%] top-[-10%] h-96 w-96 rounded-full bg-sky-500/14 blur-3xl" />
        <div className="absolute bottom-[-16%] right-[-10%] h-[28rem] w-[28rem] rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.08),transparent_28%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,1))]" />
      </div>

      <div className="relative flex min-h-screen flex-col lg:flex-row">
        <aside className="border-b border-slate-800/80 bg-slate-950/75 px-5 py-6 backdrop-blur-xl lg:min-h-screen lg:w-[300px] lg:border-b-0 lg:border-r">
          <div className="rounded-[26px] border border-sky-400/15 bg-slate-900/90 p-5 shadow-[0_30px_80px_rgba(2,6,23,0.45)]">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-400/15 text-2xl">🛡️</div>
              <div>
                <h1 className="text-xl font-black text-white">InternShield AI</h1>
                <p className="text-sm text-slate-400">Student safety startup dashboard</p>
              </div>
            </div>
            <p className="mt-5 text-sm leading-7 text-slate-400">Your AI Safety Assistant for Internship Applications</p>
            <nav className="mt-8 space-y-3">
              {screens.map(([id, icon, label]) => {
                const active = screen === id;
                return (
                  <button key={id} type="button" onClick={() => setScreen(id)} className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${active ? 'border-sky-400/30 bg-sky-400/12 text-white shadow-[0_0_30px_rgba(56,189,248,0.18)]' : 'border-transparent bg-slate-900/70 text-slate-400 hover:border-slate-800 hover:text-white'}`}>
                    <span className="text-lg">{icon}</span>
                    <span>{label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl space-y-6">
            <section className="glass-panel rounded-[30px] px-6 py-7">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-300/80">Modern AI Dashboard</p>
                  <h2 className="mt-3 text-3xl font-black text-white sm:text-4xl">Product-grade safety workflows with live trust intelligence.</h2>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
                    This now behaves more like a startup tool: auto-saved scans, evidence timeline, trust analytics, and guided verification steps.
                  </p>
                </div>
                <div className="inline-flex items-center gap-3 rounded-full border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
                  <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_24px_#22C55E]" />
                  Startup safety engine online
                </div>
              </div>
            </section>

            {screen === 'dashboard' && (
              <div className="space-y-6">
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                  {[
                    ['Total Scans', insights.metrics.totalScans, 'Auto-saved internship risk checks'],
                    ['Scam Detected', insights.metrics.scamDetected, 'High-risk results flagged for action'],
                    ['Safe Results', insights.metrics.safeResults, 'Lower-risk checks with stronger credibility'],
                    ['Avg Trust Score', `${insights.metrics.avgTrustScore}%`, 'Average confidence across the product'],
                  ].map(([label, value, hint]) => (
                    <div key={label} className="glass-panel rounded-[24px] p-5">
                      <div className="text-sm text-slate-400">{label}</div>
                      <div className="mt-3 text-3xl font-black text-white">{value}</div>
                      <div className="mt-3 text-sm text-slate-500">{hint}</div>
                    </div>
                  ))}
                </div>

                <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
                  <TrustMeterCard score={dashboardScore} status={dashboardStatus} finalScore={finalScore} />

                  <Panel title="Trust Score Insights" subtitle="Your latest trust movement and current risk posture.">
                    <div className="flex flex-col items-center justify-between gap-8 lg:flex-row">
                      <div className="max-w-md">
                        <p className={`inline-flex rounded-full border px-4 py-2 text-sm font-semibold ${metaFor(dashboardStatus).badge}`}>{metaFor(dashboardStatus).icon} {metaFor(dashboardStatus).risk}</p>
                        <h3 className="mt-5 text-3xl font-black text-white">Trust Score: {dashboardScore}%</h3>
                        <div className="mt-3 text-sm text-slate-400">Unified score: {finalScore ?? '--'}/100</div>
                        <div className="mt-5 flex flex-wrap gap-2">
                          {insights.recentTrend.length ? insights.recentTrend.map((point) => (
                            <span key={`${point.label}-${point.score}`} className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-xs text-slate-300">{point.label}: {point.score}</span>
                          )) : <span className="text-sm text-slate-500">Run your first scan to populate the trust timeline.</span>}
                        </div>
                      </div>
                    </div>
                  </Panel>
                </div>

                <Panel title="Evidence Timeline" subtitle="Recent analyses auto-saved by the backend.">
                  <div className="space-y-3">
                    {recent.length ? recent.slice(0, 6).map((entry) => (
                      <div key={entry.id} className="rounded-3xl border border-slate-800 bg-slate-950/70 px-4 py-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-semibold text-white">{entry.contentType}</p>
                            <p className="text-sm text-slate-500">{new Date(entry.createdAt).toLocaleString()}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${metaFor(entry.status).badge}`}>{entry.status}</span>
                            <span className="rounded-full bg-slate-900 px-3 py-1.5 text-sm text-slate-300">{entry.trustScore}/100</span>
                          </div>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-400">{entry.preview || 'No preview available.'}</p>
                      </div>
                    )) : <div className="dashboard-card text-sm text-slate-400">No saved scans yet. Run an analysis to build your startup timeline.</div>}
                  </div>
                </Panel>

                <div className="grid gap-6 xl:grid-cols-2">
                  <Panel title="Top Scam Patterns" subtitle="Recurring trust issues spotted across saved scans.">
                    <div className="space-y-3">
                      {topPatternPreview.length ? topPatternPreview.map((pattern) => (
                        <div key={pattern.label} className="flex items-center justify-between rounded-3xl border border-slate-800 bg-slate-950/70 px-4 py-4">
                          <span className="max-w-[75%] text-sm text-slate-300">{pattern.label}</span>
                          <span className="rounded-full border border-sky-400/25 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-200">{pattern.count} scans</span>
                        </div>
                      )) : <div className="dashboard-card text-sm text-slate-400">Top patterns will appear after a few analyses.</div>}
                    </div>
                  </Panel>

                  <Panel title="AI Source Mix" subtitle="How much of the product is powered by live Groq analysis vs fallback detection.">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="dashboard-card">
                        <div className="text-sm text-slate-400">Live Groq analyses</div>
                        <div className="mt-3 text-3xl font-black text-white">{insights.sourceMix.openai}</div>
                      </div>
                      <div className="dashboard-card">
                        <div className="text-sm text-slate-400">Fallback analyses</div>
                        <div className="mt-3 text-3xl font-black text-white">{insights.sourceMix.fallback}</div>
                      </div>
                    </div>
                  </Panel>
                </div>
              </div>
            )}

            {screen === 'offer' && (
              <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
                <Panel title="Offer Letter Analyzer" subtitle="Upload a PDF or paste an offer letter to detect startup-hiring scam patterns." action={<button type="button" onClick={() => { setOfferText(offerSample); setFile(null); setOfferState({ result: '', source: '', checklist: [], analysisId: '', summary: null }); }} className="rounded-full border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-600 hover:text-white">Reset</button>}>
                  <div className="space-y-5">
                    <label className="block">
                      <span className="mb-3 block text-sm font-semibold text-slate-300">Offer text</span>
                      <textarea value={offerText} onChange={(e) => setOfferText(e.target.value)} placeholder="Paste the offer letter content here..." className="input-panel h-72 w-full resize-none" />
                    </label>
                    <div className="upload-panel">
                      <p className="text-sm font-semibold text-white">Drag & Drop box</p>
                      <p className="mt-2 text-sm text-slate-400">Upload PDF for offer analysis</p>
                      <input type="file" accept=".pdf" onChange={(e) => setFile(e.target.files[0] || null)} className="mt-4 block w-full text-sm text-slate-300" />
                      {file && <div className="mt-4 inline-flex rounded-full border border-sky-400/25 bg-sky-400/10 px-4 py-2 text-sm text-sky-200">Upload PDF: {file.name}</div>}
                    </div>
                    <button type="button" onClick={() => analyze({ text: offerText, selectedFile: file, updateState: setOfferState, type: 'Offer Letter' })} disabled={loading === 'Offer Letter' || (!offerText.trim() && !file)} className="primary-button w-full">{loading === 'Offer Letter' ? 'Analyzing...' : 'Analyze Offer'}</button>
                  </div>
                </Panel>
                <Panel title="Result Card" subtitle="Your strongest product screen with startup-grade verification guidance.">
                  <ResultCard result={offerState.result} source={offerState.source} checklist={offerState.checklist} analysisId={offerState.analysisId} summary={offerState.summary} />
                </Panel>
              </div>
            )}

            {screen === 'message' && (
              <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
                <Panel title="Message Checker" subtitle="Paste recruiter messages, emails, or WhatsApp texts to evaluate scam pressure tactics.">
                  <div className="space-y-5">
                    <label className="block">
                      <span className="mb-3 block text-sm font-semibold text-slate-300">Recruiter message</span>
                      <textarea value={messageText} onChange={(e) => setMessageText(e.target.value)} placeholder="Paste a recruiter message or email here..." className="input-panel h-80 w-full resize-none" />
                    </label>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button type="button" onClick={() => analyze({ text: messageText, selectedFile: null, updateState: setMessageState, type: 'Message Check' })} disabled={loading === 'Message Check' || !messageText.trim()} className="primary-button flex-1">{loading === 'Message Check' ? 'Analyzing...' : 'Analyze'}</button>
                      <button type="button" onClick={() => { setMessageText(messageSample); setMessageState({ result: '', source: '', checklist: [], analysisId: '', summary: null }); }} className="rounded-2xl border border-slate-700 bg-slate-950/70 px-5 py-4 text-sm font-semibold text-slate-300 transition hover:border-slate-600 hover:text-white">Load Sample</button>
                    </div>
                  </div>
                </Panel>
                <Panel title="Result Card" subtitle="Auto-saved verdict plus next-step checklist.">
                  <ResultCard result={messageState.result} source={messageState.source} checklist={messageState.checklist} analysisId={messageState.analysisId} summary={messageState.summary} />
                </Panel>
              </div>
            )}

            {screen === 'company' && (
              <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
                <Panel title="Company Checker" subtitle="Search a company name to verify MCA registration and add company trust impact into the final score.">
                  <div className="space-y-5">
                    <label className="block">
                      <span className="mb-3 block text-sm font-semibold text-slate-300">Company name</span>
                      <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Enter company name..." className="input-panel h-14 w-full" />
                    </label>
                    <button type="button" onClick={checkCompany} disabled={loading === 'Company Check' || !companyName.trim()} className="primary-button w-full">{loading === 'Company Check' ? 'Verifying...' : 'Verify Company'}</button>
                    {companyError && <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{companyError}</div>}
                  </div>
                </Panel>
                <Panel title="Company Result" subtitle="Registration result, trust impact, risk level, and verification guidance.">
                  <CompanyCard data={companyResult} finalScore={finalScore} />
                </Panel>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
