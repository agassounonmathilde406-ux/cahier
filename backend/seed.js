require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const db = require('./db');
const { saveFile } = require('./utils/fileStorage');

async function makeSamplePdfBytes(title, pages) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  for (let i = 1; i <= pages; i++) {
    const page = doc.addPage([595, 842]);
    page.drawText(title, { x: 50, y: 780, size: 20, font, color: rgb(0.1, 0.1, 0.4) });
    page.drawText(`Page ${i} / ${pages}`, { x: 50, y: 740, size: 12, font, color: rgb(0.3, 0.3, 0.3) });
  }
  return doc.save();
}

async function seed() {
  await db.initSchema();

  const ownerEmail = process.env.OWNER_EMAIL || 'owner@cahiers-benin.com';
  const ownerPassword = process.env.OWNER_PASSWORD || 'ChangeMe123!';

  let owner = await db.prepare('SELECT * FROM users WHERE email = ?').get(ownerEmail);
  if (!owner) {
    const id = uuid();
    await db.prepare('INSERT INTO users (id,name,email,password_hash,role) VALUES (?,?,?,?,?)')
      .run(id, 'Propriétaire', ownerEmail, bcrypt.hashSync(ownerPassword, 10), 'owner');
    owner = await db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    console.log(`Compte propriétaire créé -> email: ${ownerEmail} / mot de passe: ${ownerPassword}`);
  } else {
    console.log('Compte propriétaire déjà existant.');
  }

  const subjects = ['Mathématiques', 'Physique', 'Chimie', 'SVT', 'Français', 'Anglais', 'Histoire', 'Géographie', 'Philosophie'];
  const subjectIds = {};
  for (const name of subjects) {
    let s = await db.prepare('SELECT * FROM subjects WHERE name = ?').get(name);
    if (!s) {
      const id = uuid();
      await db.prepare('INSERT INTO subjects (id, name) VALUES (?,?)').run(id, name);
      s = { id, name };
    }
    subjectIds[name] = s.id;
  }
  console.log('Matières prêtes.');

  const sampleBooks = [
    { title: 'Mathématiques — Terminale D', level: 'Terminale', series: 'D', subject: 'Mathématiques', isFree: 0, price: 1000, pages: 40, preview: 6 },
    { title: 'Physique — Terminale D', level: 'Terminale', series: 'D', subject: 'Physique', isFree: 0, price: 1000, pages: 35, preview: 5 },
    { title: 'Français — 6ème', level: '6eme', series: null, subject: 'Français', isFree: 1, price: 0, pages: 20, preview: 20 },
    { title: 'Anglais — 5ème', level: '5eme', series: null, subject: 'Anglais', isFree: 1, price: 0, pages: 18, preview: 18 },
    { title: 'Chimie — Première C', level: 'Premiere', series: 'C', subject: 'Chimie', isFree: 0, price: 1500, pages: 30, preview: 5 },
  ];

  for (const b of sampleBooks) {
    const exists = await db.prepare('SELECT * FROM books WHERE title = ?').get(b.title);
    if (exists) continue;
    const id = uuid();
    const bytes = await makeSamplePdfBytes(b.title, b.pages);
    const pdfPath = await saveFile(Buffer.from(bytes), { kind: 'pdf', extension: '.pdf' });
    await db.prepare(`INSERT INTO books
      (id,title,description,level,series,subject_id,author,cover_path,pdf_path,preview_pages,total_pages,is_free,price,status,created_by,published_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(
      id, b.title, `Cahier de cours complet — ${b.title}`, b.level, b.series, subjectIds[b.subject],
      'Équipe pédagogique', null, pdfPath, b.preview, b.pages, b.isFree, b.price, 'published', owner.id,
      new Date().toISOString()
    );
  }
  console.log('Cahiers d\'exemple créés.');
  console.log('\nSeed terminé.');
}

seed()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
