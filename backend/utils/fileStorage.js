// utils/fileStorage.js
// Stocke les PDF/couvertures sur Cloudinary (persistant, gratuit) si les
// variables CLOUDINARY_* sont renseignées. Sinon, repli sur le disque local
// (pratique en développement, mais PAS persistant sur Render en production).
const fs = require('fs');
const path = require('path');
const { v4: uuid } = require('uuid');

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'data');

const cloudinaryConfigured = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

let cloudinary;
if (cloudinaryConfigured) {
  cloudinary = require('cloudinary').v2;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

function uploadBufferToCloudinary(buffer, { folder, resourceType, filename }) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType, public_id: filename, overwrite: false },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

// Enregistre un fichier (couverture ou PDF) et renvoie la référence à stocker
// en base : une URL Cloudinary (https://...) si configuré, sinon un chemin
// local (mode développement uniquement — pas persistant en production).
async function saveFile(buffer, { kind, extension }) {
  const filename = uuid();
  if (cloudinaryConfigured) {
    const folder = kind === 'cover' ? 'cahiers-benin/covers' : 'cahiers-benin/pdfs';
    const resourceType = kind === 'cover' ? 'image' : 'raw';
    const result = await uploadBufferToCloudinary(buffer, { folder, resourceType, filename });
    return result.secure_url;
  }
  const dir = path.join(UPLOADS_DIR, kind === 'cover' ? 'covers' : 'pdfs');
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${filename}${extension || ''}`);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

// Lit les octets d'un fichier stocké, que ce soit une URL Cloudinary
// (https://...) ou un chemin local (mode développement).
async function readFileBytes(pathOrUrl) {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    const res = await fetch(pathOrUrl);
    if (!res.ok) throw new Error(`Impossible de récupérer le fichier (${res.status}).`);
    return Buffer.from(await res.arrayBuffer());
  }
  return fs.readFileSync(pathOrUrl);
}

// Utile pour construire l'URL publique d'une couverture (voir routes/books.js)
function isRemoteUrl(pathOrUrl) {
  return /^https?:\/\//i.test(pathOrUrl || '');
}

module.exports = { saveFile, readFileBytes, isRemoteUrl, cloudinaryConfigured };
