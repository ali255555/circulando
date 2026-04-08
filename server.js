/**
 * server.js – Circulando backend (Node/Express sample)
 *
 * Provides:
 *  POST /api/articles      – Publish an article (validates trueque categories)
 *  GET  /api/articles      – List articles (optional ?mode=trueque filters to valid categories)
 *  GET  /api/trueque/categories – Return the list of categories allowed for trueque
 *
 * Install dependencies:  npm install express cors
 * Run:                   node server.js
 * The server listens on http://localhost:3000
 */

'use strict';

const express = require('express');
const cors    = require('cors');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

/* ============================================================
   CATEGORY DATA  (must stay in sync with the frontend list)
============================================================ */

/** All categories the platform supports */
const CATEGORIES = [
  { id: 'coches',            name: 'Coches',             truequeAllowed: true  },
  { id: 'motos',             name: 'Motos',              truequeAllowed: true  },
  { id: 'electronica',       name: 'Electrónica',        truequeAllowed: true  },
  { id: 'electrodomesticos', name: 'Electrodomésticos',  truequeAllowed: true  },
  { id: 'ropa',              name: 'Ropa y Moda',        truequeAllowed: true  },
  { id: 'hogar',             name: 'Hogar y Jardín',     truequeAllowed: true  },
  { id: 'deportes',          name: 'Deportes',           truequeAllowed: true  },
  { id: 'juguetes',          name: 'Juguetes',           truequeAllowed: true  },
  { id: 'libros',            name: 'Libros y Música',    truequeAllowed: true  },
  { id: 'informatica',       name: 'Informática',        truequeAllowed: true  },
  { id: 'coleccionismo',     name: 'Coleccionismo',      truequeAllowed: true  },
  // NOT valid for trueque
  { id: 'inmobiliaria',      name: 'Inmobiliaria',       truequeAllowed: false },
  { id: 'empleo',            name: 'Empleo',             truequeAllowed: false },
  { id: 'accesorios_motor',  name: 'Accesorios Motor',   truequeAllowed: false },
  { id: 'servicios',         name: 'Servicios',          truequeAllowed: false },
  { id: 'otros',             name: 'Otros',              truequeAllowed: false },
];

const categoryById = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

/** IDs of categories allowed in trueque mode */
const TRUEQUE_VALID_CATEGORY_IDS = new Set(
  CATEGORIES.filter(c => c.truequeAllowed).map(c => c.id)
);

/* ============================================================
   IN-MEMORY ARTICLE STORE  (replace with DB in production)
============================================================ */
let articles = [];
let nextId   = 1;

/* ============================================================
   VALIDATION HELPERS
============================================================ */

function validateCategory(categoryId) {
  if (!categoryId) return { valid: false, error: 'El campo "category" es obligatorio.' };
  if (!categoryById[categoryId]) {
    return { valid: false, error: `Categoría "${categoryId}" no existe.` };
  }
  return { valid: true };
}

function validateTruequeCategory(categoryId) {
  const base = validateCategory(categoryId);
  if (!base.valid) return base;

  if (!TRUEQUE_VALID_CATEGORY_IDS.has(categoryId)) {
    const validList = [...TRUEQUE_VALID_CATEGORY_IDS].join(', ');
    return {
      valid: false,
      error: `La categoría "${categoryById[categoryId].name}" no está permitida en modo trueque. ` +
             `Categorías válidas: ${validList}.`,
    };
  }
  return { valid: true };
}

function validateArticle(body) {
  const errors = [];

  if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
    errors.push('El campo "title" es obligatorio.');
  }

  const mode = body.mode;
  if (!['venta', 'trueque'].includes(mode)) {
    errors.push('El campo "mode" debe ser "venta" o "trueque".');
  }

  if (mode === 'trueque') {
    const catCheck = validateTruequeCategory(body.category);
    if (!catCheck.valid) errors.push(catCheck.error);
  } else {
    const catCheck = validateCategory(body.category);
    if (!catCheck.valid) errors.push(catCheck.error);
  }

  if (body.postal !== undefined) {
    const postal = String(body.postal).trim();
    if (!/^\d{5}$/.test(postal)) {
      errors.push('El código postal debe ser un número de 5 dígitos.');
    }
  }

  if (body.price !== undefined && (typeof body.price !== 'number' || body.price < 0)) {
    errors.push('El campo "price" debe ser un número positivo o cero.');
  }

  return { valid: errors.length === 0, errors };
}

/* ============================================================
   ROUTES
============================================================ */

app.get('/api/trueque/categories', (req, res) => {
  const allowed = CATEGORIES.filter(c => c.truequeAllowed);
  res.json({ ok: true, data: allowed });
});

app.get('/api/categories', (req, res) => {
  res.json({ ok: true, data: CATEGORIES });
});

app.get('/api/articles', (req, res) => {
  let result = [...articles];
  const { mode, category } = req.query;

  if (mode === 'trueque') {
    result = result.filter(
      a => a.mode === 'trueque' && TRUEQUE_VALID_CATEGORY_IDS.has(a.category)
    );
  } else if (mode) {
    result = result.filter(a => a.mode === mode);
  }

  if (category) {
    result = result.filter(a => a.category === category);
  }

  res.json({ ok: true, data: result, total: result.length });
});

app.get('/api/articles/:id', (req, res) => {
  const article = articles.find(a => a.id === parseInt(req.params.id));
  if (!article) return res.status(404).json({ ok: false, error: 'Artículo no encontrado.' });
  res.json({ ok: true, data: article });
});

/**
 * POST /api/articles
 * Body: { title, category, price, mode, postal, description?, imageUrl? }
 * Returns 400 if mode=trueque and category not in allowed list.
 */
app.post('/api/articles', (req, res) => {
  const body = req.body;
  const { valid, errors } = validateArticle(body);

  if (!valid) {
    return res.status(400).json({ ok: false, errors });
  }

  const article = {
    id:          nextId++,
    title:       body.title.trim(),
    category:    body.category,
    price:       typeof body.price === 'number' ? body.price : 0,
    mode:        body.mode,
    postal:      body.postal ? String(body.postal).trim() : null,
    description: body.description || '',
    imageUrl:    body.imageUrl   || null,
    createdAt:   new Date().toISOString(),
  };

  articles.push(article);
  res.status(201).json({ ok: true, data: article });
});

app.delete('/api/articles/:id', (req, res) => {
  const idx = articles.findIndex(a => a.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ ok: false, error: 'Artículo no encontrado.' });
  articles.splice(idx, 1);
  res.json({ ok: true });
});

app.get('/health', (req, res) => res.json({ ok: true, uptime: process.uptime() }));

app.listen(PORT, () => {
  console.log(`Circulando server running on http://localhost:${PORT}`);
  console.log(`  POST /api/articles                       – publish an article`);
  console.log(`  GET  /api/articles                       – list all articles`);
  console.log(`  GET  /api/articles?mode=trueque          – list trueque articles (valid categories only)`);
  console.log(`  GET  /api/trueque/categories             – list trueque-allowed categories`);
});

module.exports = app; // export for testing
