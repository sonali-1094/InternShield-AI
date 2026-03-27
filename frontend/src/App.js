import React, { useMemo, useState } from 'react';
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

const companyLookup = {
  'xyz pvt ltd': {
    company: 'XYZ Pvt Ltd',
    rating: '2.1/5',
    trustScore: 40,
    status: 'SUSPICIOUS',
    issues: ['Payment complaints', 'No official website', 'No verified internship history'],
    summary: 'This company shows suspicious activity.',
  },
  'bright future solutions': {
    company: 'Bright Future Solutions',
    rating: '1.8/5',
    trustScore: 28,
    status: 'SCAM',
    issues: ['Advance fee reports', 'No interview flow', 'Generic recruiter profile'],
    summary: 'This company profile strongly matches scam patterns.',
  },
  'acme digital': {
    company: 'Acme Digital',
    rating: '4.3/5',
    trustScore: 84,
    status: 'SAFE',
    issues: ['Minor public footprint gaps'],
    summary: 'This company looks mostly credible.',
  },
};

function parseStructuredResult(raw) {
  if (!raw || raw.startsWith('Error:')) return null;
  const section = (title, next) => {
    const pattern = new RegExp(`${title}:\\s*([\\s\\S]*?)(?=\\n(?:${next.join('|')}):|$)`, 'i');
    return raw.match(pattern)?.[1]?.trim() || '';
  };
  return {
    status: raw.match(/Status:\s*(SAFE|SUSPICIOUS|SCAM)/i)?.[1]?.toUpperCase() || '',
    trustScore: Number(raw.match(/Trust Score:\s*(\d{1,3})\s*\/\s*100/i)?.[1] || 0),
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

function Gauge({ score, status }) {
  const meta = metaFor(status);
  const value = Number.isFinite(score) ? score : 0;
  const circumference = 2 * Math.PI * 52;
  return (
    <div className="relative flex h-40 w-40 items-center justify-center">
      <svg viewBox="0 0 140 140" className="h-40 w-40 -rotate-90">
        <circle cx="70" cy="70" r="52" fill="none" stroke="rgba(148,163,184,.16)" strokeWidth="10" />
        <circle
          cx="70"
          cy="70"
          r="52"
          fill="none"
          stroke={meta.accent}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (value / 100) * circumference}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-4xl font-black text-white">{value}%</div>
        <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Trust Score</div>
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

function ResultCard({ result, source }) {
  const parsed = parseStructuredResult(result);
  if (!result) {
    return (
      <div className="dashboard-card flex min-h-[420px] flex-col justify-between">
        <div>
          <div className="inline-flex rounded-full border border-sky-400/20 bg-sky-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-sky-300">
            Your AI Safety Assistant for Internship Applications
          </div>
          <h3 className="mt-6 text-3xl font-black text-white">The result card appears here.</h3>
          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-400">
            Upload a PDF or paste text to get a trust score, status, explanation, and advice.
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {['🛡️ Safe', '⚠️ Suspicious', '🚨 Scam'].map((item) => (
            <div key={item} className="rounded-3xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
              {item}
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (result.startsWith('Error:')) {
    return <div className="result-panel border-rose-500/30 bg-rose-500/10 text-sm text-rose-100">{result}</div>;
  }
  const status = parsed?.status || '';
  const meta = metaFor(status);
  const flags = listItems(parsed?.redFlags);
  return (
    <div className="space-y-5 animate-rise">
      {source === 'fallback' && <div className="rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">Using fallback detection because the live model is unavailable.</div>}
      <div className={`result-panel ${meta.panel}`}>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${meta.badge}`}>{meta.icon} {meta.title}</div>
            <h3 className="mt-5 text-4xl font-black text-white">{meta.title === 'Scam Detected' ? 'SCAM DETECTED' : meta.title.toUpperCase()}</h3>
            <div className="mt-3 text-lg font-semibold text-slate-200">Trust Score: {parsed?.trustScore || 0}/100</div>
            <div className="mt-2 text-sm uppercase tracking-[0.24em] text-slate-400">{meta.risk}</div>
          </div>
          <Gauge score={parsed?.trustScore || 0} status={status} />
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="dashboard-card">
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-rose-300">🚨 Red Flags</div>
          <div className="mt-5 space-y-3">
            {(flags.length ? flags : ['No specific red flags were extracted.']).map((flag) => (
              <div key={flag} className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-200">{flag}</div>
            ))}
          </div>
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

function CompanyCard({ data }) {
  if (!data) {
    return (
      <div className="dashboard-card min-h-[320px]">
        <div className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-300">Company Intelligence</div>
        <div className="mt-4 text-sm leading-7 text-slate-400">Search a company name to see rating, trust score, issues, and a quick summary.</div>
      </div>
    );
  }
  const meta = metaFor(data.status);
  return (
    <div className={`result-panel ${meta.panel} animate-rise`}>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className={`inline-flex rounded-full border px-4 py-2 text-sm font-semibold ${meta.badge}`}>{meta.icon} {meta.title}</div>
          <h3 className="mt-5 text-3xl font-black text-white">{data.company}</h3>
          <div className="mt-3 text-slate-300">⭐ Rating: {data.rating}</div>
          <div className="mt-2 text-slate-300">📊 Trust Score: {data.trustScore}/100</div>
        </div>
        <Gauge score={data.trustScore} status={data.status} />
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="dashboard-card">
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-300">🚨 Issues</div>
          <div className="mt-4 space-y-3">
            {data.issues.map((issue) => <div key={issue} className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-200">{issue}</div>)}
          </div>
        </div>
        <div className="dashboard-card">
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-300">🧠 Summary</div>
          <div className="mt-4 text-sm leading-7 text-slate-300">{data.summary}</div>
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
  const [offerResult, setOfferResult] = useState('');
  const [offerSource, setOfferSource] = useState('');
  const [messageResult, setMessageResult] = useState('');
  const [messageSource, setMessageSource] = useState('');
  const [loading, setLoading] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyResult, setCompanyResult] = useState(null);
  const [recent, setRecent] = useState([
    { name: 'Bright Future Solutions', status: 'SCAM', score: 28, type: 'Offer Letter' },
    { name: 'XYZ Pvt Ltd', status: 'SUSPICIOUS', score: 40, type: 'Company Check' },
    { name: 'Acme Digital', status: 'SAFE', score: 84, type: 'Company Check' },
  ]);

  const analyzed = useMemo(() => {
    const values = [];
    const offer = parseStructuredResult(offerResult);
    const message = parseStructuredResult(messageResult);
    if (offer?.status) values.push({ status: offer.status, score: offer.trustScore });
    if (message?.status) values.push({ status: message.status, score: message.trustScore });
    if (companyResult?.status) values.push({ status: companyResult.status, score: companyResult.trustScore });
    return values;
  }, [offerResult, messageResult, companyResult]);

  const metrics = useMemo(() => {
    const base = { totalScans: 128, scamDetected: 14, safeResults: 79, avgTrustScore: 67 };
    if (!analyzed.length) return base;
    return {
      totalScans: base.totalScans + analyzed.length,
      scamDetected: base.scamDetected + analyzed.filter((item) => item.status === 'SCAM').length,
      safeResults: base.safeResults + analyzed.filter((item) => item.status === 'SAFE').length,
      avgTrustScore: Math.round(analyzed.reduce((sum, item) => sum + item.score, base.avgTrustScore) / (analyzed.length + 1)),
    };
  }, [analyzed]);

  const dashboardScore = analyzed.at(-1)?.score || metrics.avgTrustScore;
  const dashboardStatus = analyzed.at(-1)?.status || (dashboardScore < 45 ? 'SCAM' : dashboardScore < 70 ? 'SUSPICIOUS' : 'SAFE');

  const analyze = async ({ text, selectedFile, setResult, setSource, type, name }) => {
    setLoading(type);
    setResult('');
    setSource('');
    const formData = new FormData();
    if (text) formData.append('text', text);
    if (selectedFile) formData.append('file', selectedFile);
    try {
      const res = await axios.post('http://localhost:5000/api/analyze', formData);
      setResult(res.data.result);
      setSource(res.data.source || '');
      const parsed = parseStructuredResult(res.data.result);
      if (parsed?.status) {
        setRecent((current) => [{ name, status: parsed.status, score: parsed.trustScore, type }, ...current].slice(0, 6));
      }
    } catch (err) {
      const message = err.response?.data?.error || err.message || 'Error analyzing content. Please check your backend setup and try again.';
      setResult(`Error: ${message}`);
    } finally {
      setLoading('');
    }
  };

  const checkCompany = () => {
    const key = companyName.trim().toLowerCase();
    if (!key) return;
    const result = companyLookup[key] || {
      company: companyName,
      rating: '3.6/5',
      trustScore: /(payment|telegram|crypto|quick|urgent)/i.test(companyName) ? 38 : 63,
      status: /(payment|telegram|crypto|quick|urgent)/i.test(companyName) ? 'SUSPICIOUS' : 'SAFE',
      issues: /(payment|telegram|crypto|quick|urgent)/i.test(companyName)
        ? ['Weak digital footprint', 'High-pressure naming pattern', 'No verified public trust markers']
        : ['Limited public data available', 'Needs manual website and domain verification'],
      summary: /(payment|telegram|crypto|quick|urgent)/i.test(companyName)
        ? 'This company name shows suspicious trust signals.'
        : 'This company has mixed signals. Verify the website and recruiter email domain.',
    };
    setCompanyResult(result);
    setRecent((current) => [{ name: result.company, status: result.status, score: result.trustScore, type: 'Company Check' }, ...current].slice(0, 6));
  };

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
                <p className="text-sm text-slate-400">AI internship safety dashboard</p>
              </div>
            </div>
            <p className="mt-5 text-sm leading-7 text-slate-400">Your AI Safety Assistant for Internship Applications</p>
            <nav className="mt-8 space-y-3">
              {screens.map(([id, icon, label]) => {
                const active = screen === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setScreen(id)}
                    className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${active ? 'border-sky-400/30 bg-sky-400/12 text-white shadow-[0_0_30px_rgba(56,189,248,0.18)]' : 'border-transparent bg-slate-900/70 text-slate-400 hover:border-slate-800 hover:text-white'}`}
                  >
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
                  <h2 className="mt-3 text-3xl font-black text-white sm:text-4xl">Clean review workflows with instant scam risk signals.</h2>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
                    Focus on the result card, trust score visualization, and color-based feedback across offer letters, recruiter messages, and company checks.
                  </p>
                </div>
                <div className="inline-flex items-center gap-3 rounded-full border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
                  <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_24px_#22C55E]" />
                  AI safety engine online
                </div>
              </div>
            </section>

            {screen === 'dashboard' && (
              <div className="space-y-6">
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                  <div className="glass-panel rounded-[24px] p-5"><div className="text-sm text-slate-400">Total Scans</div><div className="mt-3 text-3xl font-black text-white">{metrics.totalScans}</div><div className="mt-3 text-sm text-slate-500">Offer letters, messages, and company checks</div></div>
                  <div className="glass-panel rounded-[24px] p-5"><div className="text-sm text-slate-400">Scam Detected</div><div className="mt-3 text-3xl font-black text-white">{metrics.scamDetected}</div><div className="mt-3 text-sm text-slate-500">High-risk results flagged for action</div></div>
                  <div className="glass-panel rounded-[24px] p-5"><div className="text-sm text-slate-400">Safe Results</div><div className="mt-3 text-3xl font-black text-white">{metrics.safeResults}</div><div className="mt-3 text-sm text-slate-500">Lower-risk checks with stronger credibility</div></div>
                  <div className="glass-panel rounded-[24px] p-5"><div className="text-sm text-slate-400">Avg Trust Score</div><div className="mt-3 text-3xl font-black text-white">{metrics.avgTrustScore}%</div><div className="mt-3 text-sm text-slate-500">Average confidence across reviewed items</div></div>
                </div>

                <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
                  <Panel title="Trust Score Chart" subtitle="A fast visual read on your current trust position.">
                    <div className="flex flex-col items-center justify-between gap-8 lg:flex-row">
                      <Gauge score={dashboardScore} status={dashboardStatus} />
                      <div className="max-w-md">
                        <p className={`inline-flex rounded-full border px-4 py-2 text-sm font-semibold ${metaFor(dashboardStatus).badge}`}>{metaFor(dashboardStatus).icon} {metaFor(dashboardStatus).risk}</p>
                        <h3 className="mt-5 text-3xl font-black text-white">Trust Score: {dashboardScore}%</h3>
                        <p className="mt-4 text-sm leading-7 text-slate-400">Use this summary to decide whether to proceed, verify more details, or stop immediately.</p>
                      </div>
                    </div>
                  </Panel>

                  <Panel title="Recent Analysis" subtitle="The latest checks appear here with status and score.">
                    <div className="space-y-3">
                      {recent.map((entry, index) => (
                        <div key={`${entry.name}-${index}`} className="flex flex-col gap-3 rounded-3xl border border-slate-800 bg-slate-950/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-semibold text-white">{entry.name}</p>
                            <p className="text-sm text-slate-500">{entry.type}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${metaFor(entry.status).badge}`}>{entry.status}</span>
                            <span className="rounded-full bg-slate-900 px-3 py-1.5 text-sm text-slate-300">{entry.score}/100</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Panel>
                </div>
              </div>
            )}

            {screen === 'offer' && (
              <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
                <Panel
                  title="Offer Letter Analyzer"
                  subtitle="Upload a PDF or paste the text of an offer letter to check for payment demands, fake recruiter patterns, and scam signals."
                  action={<button type="button" onClick={() => { setOfferText(offerSample); setFile(null); setOfferResult(''); setOfferSource(''); }} className="rounded-full border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-600 hover:text-white">Reset</button>}
                >
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
                    <button type="button" onClick={() => analyze({ text: offerText, selectedFile: file, setResult: setOfferResult, setSource: setOfferSource, type: 'Offer Letter', name: file?.name || 'Offer Letter Analysis' })} disabled={loading === 'Offer Letter' || (!offerText.trim() && !file)} className="primary-button w-full">{loading === 'Offer Letter' ? 'Analyzing...' : 'Analyze Offer'}</button>
                  </div>
                </Panel>
                <Panel title="Result Card" subtitle="The highest-signal screen in the product.">
                  <ResultCard result={offerResult} source={offerSource} />
                </Panel>
              </div>
            )}

            {screen === 'message' && (
              <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
                <Panel title="Message Checker" subtitle="Paste WhatsApp messages, email text, or recruiter replies to analyze urgency, payment asks, and suspicious identity requests.">
                  <div className="space-y-5">
                    <label className="block">
                      <span className="mb-3 block text-sm font-semibold text-slate-300">Recruiter message</span>
                      <textarea value={messageText} onChange={(e) => setMessageText(e.target.value)} placeholder="Paste a recruiter message or email here..." className="input-panel h-80 w-full resize-none" />
                    </label>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button type="button" onClick={() => analyze({ text: messageText, selectedFile: null, setResult: setMessageResult, setSource: setMessageSource, type: 'Message Check', name: 'Recruiter Message' })} disabled={loading === 'Message Check' || !messageText.trim()} className="primary-button flex-1">{loading === 'Message Check' ? 'Analyzing...' : 'Analyze'}</button>
                      <button type="button" onClick={() => { setMessageText(messageSample); setMessageResult(''); setMessageSource(''); }} className="rounded-2xl border border-slate-700 bg-slate-950/70 px-5 py-4 text-sm font-semibold text-slate-300 transition hover:border-slate-600 hover:text-white">Load Sample</button>
                    </div>
                  </div>
                </Panel>
                <Panel title="Result Card" subtitle="Color-coded verdict, explanation, and student advice.">
                  <ResultCard result={messageResult} source={messageSource} />
                </Panel>
              </div>
            )}

            {screen === 'company' && (
              <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
                <Panel title="Company Checker" subtitle="Search a company name to get a quick trust view, issues list, and summary.">
                  <div className="space-y-5">
                    <label className="block">
                      <span className="mb-3 block text-sm font-semibold text-slate-300">Company name</span>
                      <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Search company name..." className="input-panel h-14 w-full" />
                    </label>
                    <button type="button" onClick={checkCompany} disabled={!companyName.trim()} className="primary-button w-full">Check Company</button>
                  </div>
                </Panel>
                <Panel title="Company Result" subtitle="Trust score, reported issues, and quick summary.">
                  <CompanyCard data={companyResult} />
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
