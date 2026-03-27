const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const openai = apiKey ? new OpenAI({ apiKey }) : null;

const upload = multer({ storage: multer.memoryStorage() });

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
  if (/(completion certificate|internship certificate|certificate of internship)/.test(text) &&
    !/(duration|from|to|period|completed on|issued on)/.test(text)) {
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
This result was generated by InternShield AI fallback analysis because the live OpenAI API was unavailable.`;
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
      return res.json({ result, source: 'fallback' });
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
    res.json({ result, source: 'openai' });
  } catch (err) {
    console.error('AI analysis failed:', err.status || err.code || 'unknown_error', err.message);
    if (err?.status === 429 || err?.code === 'insufficient_quota') {
      const result = analyzeWithFallback(text);
      return res.json({ result, source: 'fallback' });
    }
    res.status(500).json({ error: err?.message || 'AI analysis failed' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Using OpenAI model: ${model}`);
  if (!apiKey) {
    console.warn('OPENAI_API_KEY is missing. Create backend/.env with OPENAI_API_KEY=your_key');
  }
});
