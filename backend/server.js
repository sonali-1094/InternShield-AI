// Force IPv4 DNS resolution for MongoDB Atlas SRV
const { setDefaultResultOrder } = require('dns');
setDefaultResultOrder('ipv4first');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const OpenAI = require('openai');
const mongoose = require('mongoose');
const dns = require('dns');
const fs = require('fs/promises');
const path = require('path');
const Analysis = require('./models/Analysis');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

// ✅ GROQ: Uses same OpenAI SDK — just different apiKey and baseURL
const apiKey = process.env.GROQ_API_KEY;
const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
const openai = apiKey
  ? new OpenAI({
      apiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    })
  : null;
const analysesFilePath = path.join(__dirname, 'data', 'analyses.json');
let storageMode = 'memory';
const atlasDnsFallbackServers = ['8.8.8.8', '1.1.1.1'];

const upload = multer({ storage: multer.memoryStorage() });

function isPlaceholderMongoUri(uri) {
  return /<[^>]+>/.test(uri);
}

function extractMongoSrvHost(uri) {
  const match = uri.match(/^mongodb\+srv:\/\/(?:[^@/]+@)?([^/?]+)/i);
  return match ? match[1] : null;
}

// ✅ FIXED: Use public DNS directly — no warning, no retry
async function prepareMongoDns(uri) {
  const srvHost = extractMongoSrvHost(uri);
  if (!srvHost) return;

  // Use public DNS resolvers directly to avoid local DNS SRV lookup failures
  dns.setServers(atlasDnsFallbackServers);
  const srvRecord = `_mongodb._tcp.${srvHost}`;
  await dns.promises.resolveSrv(srvRecord);
}

async function ensureAnalysesFile() {
  await fs.mkdir(path.dirname(analysesFilePath), { recursive: true });
  try {
    await fs.access(analysesFilePath);
  } catch {
    await fs.writeFile(analysesFilePath, '[]\n', 'utf8');
  }
}

async function readAnalysesFromFile() {
  await ensureAnalysesFile();
  const raw = await fs.readFile(analysesFilePath, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    console.warn('Local analyses store is invalid JSON. Resetting backend/data/analyses.json');
    await fs.writeFile(analysesFilePath, '[]\n', 'utf8');
    return [];
  }
}

async function writeAnalysesToFile(analyses) {
  await ensureAnalysesFile();
  await fs.writeFile(analysesFilePath, `${JSON.stringify(analyses, null, 2)}\n`, 'utf8');
}

async function connectDatabase() {
  if (!mongoUri) {
    storageMode = 'file';
    console.warn('MONGODB_URI is missing. Using local file storage at backend/data/analyses.json');
    await ensureAnalysesFile();
    return;
  }

  if (isPlaceholderMongoUri(mongoUri)) {
    storageMode = 'file';
    console.warn('MONGODB_URI still contains a placeholder like <db_password>. Using local file storage until it is replaced.');
    await ensureAnalysesFile();
    return;
  }

  if (mongoUri.startsWith('mongodb+srv://')) {
    await prepareMongoDns(mongoUri);
  }

  await mongoose.connect(mongoUri);
  storageMode = 'mongo';
}

function createAnalysisRecord({ text, source, summary, contentType, checklist }) {
  return {
    id: `analysis_${Date.now()}`,
    contentType,
    source,
    status: summary.status,
    trustScore: summary.trustScore,
    redFlags: summary.redFlags,
    recommendation: summary.recommendation,
    advice: summary.advice,
    explanation: summary.explanation,
    preview: text.trim().slice(0, 160),
    checklist,
    createdAt: new Date(),
  };
}

async function saveAnalysisRecord(record) {
  if (storageMode === 'mongo') {
    await Analysis.create(record);
    return;
  }

  const analyses = await readAnalysesFromFile();
  analyses.unshift(record);
  await writeAnalysesToFile(analyses.slice(0, 500));
}

async function getRecentAnalyses(limit = 50) {
  if (storageMode === 'mongo') {
    return Analysis.find()
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .lean();
  }

  const analyses = await readAnalysesFromFile();
  return analyses
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
}

async function getAnalysesForInsights(limit = 200) {
  if (storageMode === 'mongo') {
    return Analysis.find()
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .lean();
  }

  const analyses = await readAnalysesFromFile();
  return analyses
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
}

function detectContentType(text) {
  const raw = text.toLowerCase();
  if (/(offer letter|joining|selected for internship|internship offer)/.test(raw)) {
    return 'Offer Letter';
  }
  if (/(completion certificate|internship certificate|issued on|certify)/.test(raw)) {
    return 'Certificate';
  }
  if (/(telegram|whatsapp|reply quickly|recruitment desk|message)/.test(raw)) {
    return 'Message Check';
  }
  return 'General Scan';
}

function normalizeCompanyName(name = '') {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildCompanyVerification(companyName) {
  const company = `${companyName || ''}`.trim();
  const normalizedCompany = normalizeCompanyName(company);
  const registeredCompanies = new Set([
    'tata consultancy services',
    'infosys',
    'wipro',
    'reliance industries',
  ]);

  const isRegistered = registeredCompanies.has(normalizedCompany);
  const trustScore = isRegistered ? 80 : 30;
  const status = isRegistered ? 'Registered (MCA Verified)' : 'Not Found in MCA';
  const riskLevel = isRegistered ? 'LOW' : 'HIGH';

  return {
    company,
    registered: isRegistered,
    status,
    trustScore,
    riskLevel,
    message: isRegistered
      ? 'This company is officially registered with MCA.'
      : 'Company not found in MCA database. This may be risky.',
    insight: isRegistered
      ? 'This company is present in the simulated MCA registry used for the hackathon demo.'
      : 'This company is not registered in official government records in the current demo dataset.',
    advice: isRegistered
      ? 'Continue with standard checks like domain verification, recruiter email validation, and LinkedIn presence.'
      : 'Avoid proceeding unless verified through trusted sources such as the official website, LinkedIn, GST details, or direct HR confirmation.',
    verificationSource: 'Simulated MCA Registry',
  };
}

function extractResultField(rawResult, label, nextLabels) {
  const normalized = rawResult.replace(/\*\*/g, '');
  const pattern = new RegExp(
    `${label}:\\s*([\\s\\S]*?)(?=\\n(?:${nextLabels.join('|')}):|$)`,
    'i'
  );
  return normalized.match(pattern)?.[1]?.trim() || '';
}

function parseAnalysisSummary(rawResult) {
  if (!rawResult) {
    return null;
  }

  const normalized = rawResult.replace(/\*\*/g, '');

  return {
    status: normalized.match(/Status:\s*(SAFE|SUSPICIOUS|SCAM)/i)?.[1]?.toUpperCase() || 'SAFE',
    trustScore: Number(normalized.match(/Trust Score:\s*(\d{1,3})\s*\/\s*100/i)?.[1] || 0),
    redFlags: extractResultField(normalized, 'Red Flags', ['Explanation', 'Recommendation', 'Advice', 'Note'])
      .split('\n')
      .map((item) => item.replace(/^[•*-]\s*/, '').trim())
      .filter(Boolean),
    explanation: extractResultField(normalized, 'Explanation', ['Recommendation', 'Advice', 'Note']),
    recommendation: extractResultField(normalized, 'Recommendation', ['Advice', 'Note']),
    advice: extractResultField(normalized, 'Advice', ['Note']),
  };
}

function buildVerificationChecklist({ status, contentType, trustScore, redFlags }) {
  const checklist = [
    {
      id: 'domain-check',
      title: 'Verify official email and domain',
      detail: 'Confirm the recruiter email matches the official company website and does not use a free mail provider.',
      priority: status === 'SCAM' ? 'critical' : 'high',
    },
    {
      id: 'web-presence',
      title: 'Check public company footprint',
      detail: 'Look for the company website, LinkedIn page, internship posts, and complaint history before replying.',
      priority: trustScore <= 45 ? 'high' : 'medium',
    },
    {
      id: 'payment-check',
      title: 'Reject any payment request',
      detail: 'Never pay registration, training, or certificate fees to secure an internship or offer letter.',
      priority: redFlags.some((flag) => /payment|fee|deposit/i.test(flag)) ? 'critical' : 'medium',
    },
  ];

  if (contentType === 'Offer Letter') {
    checklist.push({
      id: 'offer-terms',
      title: 'Validate offer terms',
      detail: 'Check whether the role, stipend, joining date, reporting manager, and office location are clearly listed.',
      priority: 'medium',
    });
  }

  if (contentType === 'Certificate') {
    checklist.push({
      id: 'certificate-proof',
      title: 'Verify certificate authenticity',
      detail: 'Cross-check internship duration, issue date, issuer name, and whether the company confirms the certificate.',
      priority: 'high',
    });
  }

  if (contentType === 'Message Check' || contentType === 'General Scan') {
    checklist.push({
      id: 'reply-template',
      title: 'Ask a verification question before responding',
      detail: 'Request the official website, role description, and company email before sharing any documents.',
      priority: 'medium',
    });
  }

  return checklist;
}

function buildInsights(analyses) {
  const totalScans = analyses.length;
  const scamDetected = analyses.filter((item) => item.status === 'SCAM').length;
  const safeResults = analyses.filter((item) => item.status === 'SAFE').length;
  const avgTrustScore = totalScans
    ? Math.round(analyses.reduce((sum, item) => sum + item.trustScore, 0) / totalScans)
    : 0;

  const recentTrend = analyses
    .slice(0, 7)
    .reverse()
    .map((item) => ({
      label: new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      score: item.trustScore,
      status: item.status,
    }));

  const patternCounts = {};
  analyses.forEach((item) => {
    item.redFlags.slice(0, 3).forEach((flag) => {
      patternCounts[flag] = (patternCounts[flag] || 0) + 1;
    });
  });

  const topPatterns = Object.entries(patternCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, count]) => ({ label, count }));

  return {
    metrics: {
      totalScans,
      scamDetected,
      safeResults,
      avgTrustScore,
    },
    recentTrend,
    topPatterns,
    sourceMix: {
      openai: analyses.filter((item) => item.source === 'openai' || item.source === 'groq').length,
      groq: analyses.filter((item) => item.source === 'groq').length,
      fallback: analyses.filter((item) => item.source === 'fallback').length,
    },
  };
}

function analyzeWithFallback(rawText) {
  const text = rawText.toLowerCase();
  const redFlags = [];
  let riskPoints = 0;

  const checks = [
    {
      test: /(registration fee|training fee|deposit|security deposit|processing fee|pay rs|pay ₹|payment required)/,
      flag: 'Requests payment before joining.',
      points: 35,
    },
    {
      test: /(urgent|act fast|limited seats|immediate joining|join immediately|last date today)/,
      flag: 'Uses urgency or pressure tactics.',
      points: 12,
    },
    {
      test: /(guaranteed job|100% placement|no interview|instant offer|earn \d|salary up to \d+.*without experience)/,
      flag: 'Makes unrealistic promises about selection or salary.',
      points: 18,
    },
    {
      test: /(gmail\.com|yahoo\.com|outlook\.com|hotmail\.com)/,
      flag: 'Uses a generic email domain instead of an official company domain.',
      points: 10,
    },
    {
      test: /(dear candidate|dear applicant|selected candidate|congratulations candidate)/,
      flag: 'Uses generic greeting language.',
      points: 8,
    },
    {
      test: /(whatsapp only|telegram|dm me|contact on telegram)/,
      flag: 'Pushes communication to informal channels.',
      points: 14,
    },
    {
      test: /(work from home and earn|easy money|quick earnings|part time income)/,
      flag: 'Uses manipulative or overly positive earning language.',
      points: 10,
    },
    {
      test: /(certificate issued without work|buy certificate|pay for certificate|certificate fee|pay to receive certificate)/,
      flag: 'Looks like a paid or suspicious certificate request.',
      points: 30,
    },
    {
      test: /(completion certificate|internship certificate|certificate of internship)/,
      flag: null,
      points: 0,
    },
  ];

  checks.forEach(({ test, flag, points }) => {
    if (test.test(text)) {
      if (flag) redFlags.push(flag);
      riskPoints += points;
    }
  });

  const missingSignals = [];

  if (!/(www\.|https?:\/\/)/.test(text)) {
    missingSignals.push('No clear company website is mentioned.');
    riskPoints += 8;
  }
  if (!/(address|office|location|registered office)/.test(text)) {
    missingSignals.push('No clear company address or office details are mentioned.');
    riskPoints += 8;
  }
  if (!/(salary|stipend|ctc|compensation)/.test(text)) {
    if (/(offer letter|internship offer|job offer|joining)/.test(text)) {
      missingSignals.push('Salary or stipend details are missing or unclear.');
      riskPoints += 8;
    }
  }
  if (
    /(completion certificate|internship certificate|certificate of internship)/.test(text) &&
    !/(duration|from|to|period|completed on|issued on)/.test(text)
  ) {
    missingSignals.push('The certificate does not clearly mention internship duration or completion dates.');
    riskPoints += 8;
  }
  if (!/(role|position|intern|responsibilities|job description)/.test(text)) {
    missingSignals.push('The job role or responsibilities are not clearly explained.');
    riskPoints += 10;
  }
  if (!/(phone|email|contact)/.test(text)) {
    missingSignals.push('Verifiable contact details are missing.');
    riskPoints += 10;
  }

  redFlags.push(...missingSignals);

  if (redFlags.length === 0) {
    redFlags.push('No major scam keywords were found, but this should still be verified manually.');
    riskPoints += 20;
  }

  const trustScore = Math.max(5, Math.min(95, 100 - riskPoints));
  let status = 'SAFE';
  let recommendation = 'This looks reasonably safe, but still verify key details.';

  if (trustScore <= 30) {
    status = 'SCAM';
    recommendation = 'Do not continue with this internship.';
  } else if (trustScore <= 70) {
    status = 'SUSPICIOUS';
    recommendation = 'Proceed only after verification.';
  }

  const explanation =
    status === 'SCAM'
      ? 'This content shows multiple strong scam indicators. It may be trying to rush you, hide company details, fake a certificate, or ask for money before a genuine hiring process.'
      : status === 'SUSPICIOUS'
        ? 'Some important details are missing or look unusual. That does not prove it is fake, but it is risky enough that you should verify the company, sender, and document details before responding.'
        : 'This content does not show major scam patterns in the text itself, but students should still confirm the company, role, certificate details, and contact information independently.';

  const advice =
    status === 'SCAM'
      ? 'Do not pay any fee, do not share personal documents, and verify the company or certificate issuer through its official website and LinkedIn before taking any next step.'
      : status === 'SUSPICIOUS'
        ? 'Ask for the company website, official email, job description or certificate verification details, stipend details if applicable, and office address before accepting anything.'
        : 'Verify the recruiter or certificate issuer on LinkedIn, confirm the company website, and make sure the role or internship duration matches what is written.';

  const formattedFlags = redFlags.map((flag) => `- ${flag}`).join('\n');

  return `Status: ${status}

Trust Score: ${trustScore}/100

Red Flags:
${formattedFlags}

Explanation:
${explanation}

Recommendation:
${recommendation}

Advice:
${advice}

Note:
This result was generated by InternShield AI fallback analysis because the live AI model was unavailable.`;
}

app.post('/api/analyze', upload.single('file'), async (req, res) => {
  let text = req.body.text || '';
  if (req.file) {
    try {
      const data = await pdfParse(req.file.buffer);
      text = data.text;
    } catch (err) {
      return res.status(400).json({ error: 'Failed to parse PDF' });
    }
  }
  if (!text) return res.status(400).json({ error: 'No text or file provided' });

  const systemPrompt = `You are an expert in analyzing internship offer letters, internship emails, recruitment messages, and internship completion certificates for fraud detection.

Be strict while detecting scams.
If legitimacy is unclear, treat the content as suspicious rather than safe.
Keep the explanation clear, student-friendly, and practical.
Always point out the exact red flags and give a direct recommendation on whether the student should avoid the internship, verify more details first, or proceed carefully.
You should detect whether the submitted text looks like an internship offer, internship email, or internship completion certificate, and judge whether it appears real or suspicious based on the text.`;

  const userPrompt = `You are an expert in analyzing internship offer letters, internship emails, and internship completion certificates for fraud detection.

Carefully analyze the structure and content of the submitted internship-related text.

Check for:
- Missing company registration details
- Lack of official letterhead formatting
- No clear job role description
- No salary structure or vague terms
- Payment requests before joining
- Fake HR signatures or generic names
- No verifiable contact information
- Missing certificate issue date, duration, or issuer details if it is a completion certificate

Also analyze:
- Language professionalism
- Formatting authenticity
- Legal validity indicators
- Whether it looks like an offer letter, internship email, or internship completion certificate
- Whether it appears real, suspicious, or scam based only on the text clues

Then provide output in this format:

Status:
Trust Score:
Red Flags:
Explanation:
Recommendation:
Advice:

Use only these status labels when appropriate:
- SAFE
- SUSPICIOUS
- SCAM

For Recommendation, use one of these styles:
- Do not continue with this internship.
- Proceed only after verification.
- This looks reasonably safe, but still verify key details.

Content to analyze:
${text}`;

  try {
    if (!openai) {
      const result = analyzeWithFallback(text);
      const summary = parseAnalysisSummary(result);
      const contentType = detectContentType(text);
      const checklist = buildVerificationChecklist({
        status: summary.status,
        contentType,
        trustScore: summary.trustScore,
        redFlags: summary.redFlags,
      });
      const record = createAnalysisRecord({
        text,
        source: 'fallback',
        summary,
        contentType,
        checklist,
      });
      await saveAnalysisRecord(record);
      return res.json({
        result,
        source: 'fallback',
        analysisId: record.id,
        checklist,
        summary,
      });
    }

    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 700,
    });
    const result = response.choices[0].message.content;
    const summary = parseAnalysisSummary(result);
    const contentType = detectContentType(text);
    const checklist = buildVerificationChecklist({
      status: summary.status,
      contentType,
      trustScore: summary.trustScore,
      redFlags: summary.redFlags,
    });
    const record = createAnalysisRecord({
      text,
      source: 'groq',
      summary,
      contentType,
      checklist,
    });
    await saveAnalysisRecord(record);
    res.json({
      result,
      source: 'groq',
      analysisId: record.id,
      checklist,
      summary,
    });
  } catch (err) {
    console.error('AI analysis failed:', err.status || err.code || 'unknown_error', err.message);
    if (err?.status === 429 || err?.code === 'insufficient_quota') {
      const result = analyzeWithFallback(text);
      const summary = parseAnalysisSummary(result);
      const contentType = detectContentType(text);
      const checklist = buildVerificationChecklist({
        status: summary.status,
        contentType,
        trustScore: summary.trustScore,
        redFlags: summary.redFlags,
      });
      const record = createAnalysisRecord({
        text,
        source: 'fallback',
        summary,
        contentType,
        checklist,
      });
      await saveAnalysisRecord(record);
      return res.json({
        result,
        source: 'fallback',
        analysisId: record.id,
        checklist,
        summary,
      });
    }
    res.status(500).json({ error: err?.message || 'AI analysis failed' });
  }
});

app.post('/check-company', async (req, res) => {
  const { company } = req.body || {};

  if (!`${company || ''}`.trim()) {
    return res.status(400).json({ error: 'Company name is required' });
  }

  return res.json(buildCompanyVerification(company));
});

app.get('/api/analyses', async (_req, res) => {
  try {
    const analyses = await getRecentAnalyses();
    res.json(analyses);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load analyses' });
  }
});

app.get('/api/insights', async (_req, res) => {
  try {
    const analyses = await getAnalysesForInsights();
    res.json(buildInsights(analyses));
  } catch (err) {
    res.status(500).json({ error: 'Failed to load insights' });
  }
});

const PORT = process.env.PORT || 5000;
connectDatabase()
  .then(() => {
    if (storageMode === 'mongo') {
      console.log('Connected to MongoDB');
    } else {
      console.log('Using local file storage for analyses');
    }
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Using Groq model: ${model}`);
      if (!apiKey) {
        console.warn('GROQ_API_KEY is missing. Add GROQ_API_KEY=gsk_... to your backend/.env file');
      }
    });
  })
  .catch((err) => {
    storageMode = 'file';
    console.warn(`Failed to connect to MongoDB: ${err.message}`);
    console.warn('Falling back to local file storage at backend/data/analyses.json');
    ensureAnalysesFile()
      .then(() => {
        app.listen(PORT, () => {
          console.log(`Server running on port ${PORT}`);
          console.log(`Using Groq model: ${model}`);
          if (!apiKey) {
            console.warn('GROQ_API_KEY is missing. Add GROQ_API_KEY=gsk_... to your backend/.env file');
          }
        });
      })
      .catch((fileErr) => {
        console.error('Failed to initialize local file storage:', fileErr.message);
        process.exit(1);
      });
  });
