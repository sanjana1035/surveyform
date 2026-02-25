const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const DATA_PATH = path.join(__dirname, 'data.json');
let memoryData = { forms: [], responses: [] }; // In-memory fallback for Vercel

function readData(){
  // Try file storage first (works locally)
  try{
    const raw = fs.readFileSync(DATA_PATH, 'utf8');
    return JSON.parse(raw);
  }catch(e){
    // Fallback to in-memory storage (used on Vercel or if file doesn't exist yet)
    return memoryData;
  }
}

function writeData(data){
  memoryData = data; // Always update memory
  // Try to write to file (works locally, silently fails on Vercel)
  try{
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
  }catch(e){
    // Silently fail on Vercel (no writable filesystem); data persists in memory during request
  }
}

app.get('/', (req, res) => {
  const data = readData();
  res.render('index', { forms: data.forms });
});

app.get('/create', (req, res) => {
  res.render('create');
});

app.post('/create', (req, res) => {
  const { title, questions, mode, embedHtml, embedUrl } = req.body;
  // questions expected as newline-separated or comma-separated
  let qs = [];
  if (questions){
    qs = questions.split(/\r?\n|,/).map(s => s.trim()).filter(Boolean);
  }
  let embed = null;
  if (mode === 'embed'){
    if (embedHtml && embedHtml.trim()) embed = { html: embedHtml };
    else if (embedUrl && embedUrl.trim()) embed = { url: embedUrl };
  }
  const id = uuidv4();
  const form = { id, title: title || 'Untitled survey', questions: qs, embed, createdAt: Date.now() };
  const data = readData();
  data.forms.push(form);
  writeData(data);
  res.redirect(`/form/${id}`);
});

app.get('/form/:id', (req, res) => {
  const id = req.params.id;
  const data = readData();
  const form = data.forms.find(f => f.id === id);
  if (!form) return res.status(404).send('Form not found');
  const shareUrl = `${req.protocol}://${req.get('host')}/form/${id}`;
  res.render('form', { form, shareUrl });
});

app.post('/submit/:id', (req, res) => {
  const id = req.params.id;
  const data = readData();
  const form = data.forms.find(f => f.id === id);
  if (!form) return res.status(404).send('Form not found');
  const answers = form.questions.map((q, idx) => ({ question: q, answer: req.body[`q_${idx}`] || '' }));
  const response = { id: uuidv4(), formId: id, answers, submittedAt: Date.now() };
  data.responses.push(response);
  writeData(data);
  res.redirect(`/thanks`);
});

app.get('/thanks', (req, res) => {
  res.render('thanks');
});

app.get('/results/:id', (req, res) => {
  const id = req.params.id;
  const data = readData();
  const form = data.forms.find(f => f.id === id);
  if (!form) return res.status(404).send('Form not found');
  const responses = data.responses.filter(r => r.formId === id);
  res.render('results', { form, responses });
});

// simple API to fetch form JSON
app.get('/api/form/:id', (req, res) => {
  const id = req.params.id;
  const data = readData();
  const form = data.forms.find(f => f.id === id);
  if (!form) return res.status(404).json({ error: 'not found' });
  res.json(form);
});

// Import a Typeform form into the local app (requires TYPEFORM_TOKEN in .env)
app.post('/import/typeform', async (req, res) => {
  const { typeformId } = req.body;
  if (!process.env.TYPEFORM_TOKEN) return res.status(400).json({ error: 'Missing TYPEFORM_TOKEN in environment' });
  if (!typeformId) return res.status(400).json({ error: 'Missing typeformId in body' });
  try{
    const resp = await axios.get(`https://api.typeform.com/forms/${typeformId}`, {
      headers: { Authorization: `Bearer ${process.env.TYPEFORM_TOKEN}` }
    });
    const tf = resp.data;
    const title = tf.title || `Typeform ${typeformId}`;
    const questions = (tf.fields || []).map(f => f.title || f.ref || f.id).filter(Boolean);
    const id = uuidv4();
    const form = { id, title, questions, embed: { provider: 'typeform', id: typeformId, url: `https://form.typeform.com/to/${typeformId}` }, createdAt: Date.now() };
    const data = readData();
    data.forms.push(form);
    writeData(data);
    res.json({ ok: true, form });
  }catch(err){
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

// Sync responses from a Typeform-backed local form. Finds local form with matching embed.provider/typeform and appends raw responses.
app.post('/sync/typeform/:id', async (req, res) => {
  const localId = req.params.id;
  if (!process.env.TYPEFORM_TOKEN) return res.status(400).json({ error: 'Missing TYPEFORM_TOKEN in environment' });
  const data = readData();
  const form = data.forms.find(f => f.id === localId && f.embed && f.embed.provider === 'typeform');
  if (!form) return res.status(404).json({ error: 'Local form not found or not a Typeform import' });
  const typeformId = form.embed.id;
  try{
    const resp = await axios.get(`https://api.typeform.com/forms/${typeformId}/responses`, {
      headers: { Authorization: `Bearer ${process.env.TYPEFORM_TOKEN}` }
    });
    const results = resp.data?.items || resp.data?.items || resp.data?.responses || [];
    // Append raw responses; map to our storage shape so results view can handle them.
    results.forEach(r => {
      const response = { id: uuidv4(), formId: localId, raw: r, submittedAt: Date.now() };
      data.responses.push(response);
    });
    writeData(data);
    res.json({ ok: true, added: results.length });
  }catch(err){
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

if (!fs.existsSync(DATA_PATH)) writeData({ forms: [], responses: [] });

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
