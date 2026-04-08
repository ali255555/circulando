/**
 * server.js — Circulando backend example (Node.js / Express)
 *
 * Endpoints:
 *   POST /api/listings      — create a listing (validates trueque categories + images)
 *   GET  /api/listings      — list all listings
 *   GET  /api/listings?mode=trueque  — list only trueque-allowed listings
 *
 * Run:
 *   npm install express
 *   node server.js
 *
 * The server listens on http://localhost:3000
 */

import express from "express";
import { URL } from "url";

const app = express();
app.use(express.json());

/* ============================================================
   TRUEQUE POLICY
   In trueque mode only direct-exchange vehicles are allowed.
   ============================================================ */
const TRUEQUE_ALLOWED_CATEGORIES = new Set(["cars", "motorcycles"]);

function isAllowedInTrueque(listing) {
  const cat = listing?.category ?? "others";
  return TRUEQUE_ALLOWED_CATEGORIES.has(cat);
}

/* ============================================================
   IMAGE URL VALIDATION
   ============================================================ */
function isValidHttpUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function validateImageUrls(imageUrls) {
  if (!Array.isArray(imageUrls) || imageUrls.length < 1) {
    return { ok: false, error: "At least 1 image URL is required." };
  }
  if (imageUrls.length > 10) {
    return { ok: false, error: "Maximum 10 image URLs allowed." };
  }
  for (const u of imageUrls) {
    if (typeof u !== "string" || !isValidHttpUrl(u)) {
      return { ok: false, error: `Invalid image URL: "${u}". Must be http or https.` };
    }
  }
  return { ok: true, error: "" };
}

/* ============================================================
   IN-MEMORY STORE (replace with a real DB in production)
   ============================================================ */
const listings = [];

/* ============================================================
   POST /api/listings — create a listing
   ============================================================ */
app.post("/api/listings", (req, res) => {
  const listing = req.body;

  // Basic payload validation
  if (!listing || typeof listing !== "object") {
    return res.status(400).json({ error: "Invalid payload." });
  }

  const { title, mode, category, imageUrls } = listing;

  if (!title || typeof title !== "string" || title.trim() === "") {
    return res.status(400).json({ error: "Field 'title' is required." });
  }

  if (!mode || (mode !== "compra" && mode !== "trueque")) {
    return res.status(400).json({ error: "Field 'mode' must be 'compra' or 'trueque'." });
  }

  if (!category || typeof category !== "string") {
    return res.status(400).json({ error: "Field 'category' is required." });
  }

  // Trueque category validation
  if (mode === "trueque" && !isAllowedInTrueque(listing)) {
    return res.status(422).json({
      error: `Category "${category}" is not allowed in trueque. Only "cars" and "motorcycles" are permitted.`,
      code: "TRUEQUE_CATEGORY_NOT_ALLOWED",
    });
  }

  // Image URL validation
  const imgCheck = validateImageUrls(imageUrls);
  if (!imgCheck.ok) {
    return res.status(422).json({ error: imgCheck.error, code: "INVALID_IMAGE_URLS" });
  }

  // Persist
  const saved = {
    id: String(Date.now()),
    title: title.trim(),
    mode,
    category,
    price: typeof listing.price === "number" ? listing.price : 0,
    desc: typeof listing.desc === "string" ? listing.desc.trim() : "",
    imageUrls,
    userId: typeof listing.userId === "string" ? listing.userId : "anonymous",
    createdAt: new Date().toISOString(),
  };

  listings.push(saved);
  return res.status(201).json(saved);
});

/* ============================================================
   GET /api/listings — list listings
   Query params:
     ?mode=compra|trueque   filter by mode
     ?category=<id>         filter by category
   ============================================================ */
app.get("/api/listings", (req, res) => {
  const { mode, category } = req.query;

  let result = listings.slice();

  if (mode) {
    if (mode !== "compra" && mode !== "trueque") {
      return res.status(400).json({ error: "Query param 'mode' must be 'compra' or 'trueque'." });
    }
    result = result.filter((l) => l.mode === mode);
  }

  // Extra server-side guard: even if mode filter is missing, purge invalid trueque entries
  if (mode === "trueque") {
    result = result.filter(isAllowedInTrueque);
  }

  if (category) {
    result = result.filter((l) => l.category === category);
  }

  return res.json(result);
});

/* ============================================================
   START
   ============================================================ */
const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`Circulando API listening on http://localhost:${PORT}`);
});
