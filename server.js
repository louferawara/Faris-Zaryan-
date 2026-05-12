// ══════════════════════════════════════════════════════
//  FOLIO & INK — Node.js Backend Server
//  Run: node server.js
//  API Base: http://localhost:3001/api
// ══════════════════════════════════════════════════════

const http = require('http');
const fs   = require('fs');
const path = require('path');
const url  = require('url');

const PORT    = 3001;
const DB_FILE = path.join(__dirname, 'db.json');

// ── Helpers ────────────────────────────────────────────
function readDB() {
  if (!fs.existsSync(DB_FILE)) return { books: [], categories: [], orders: [] };
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}
function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}
function send(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data));
}
function body(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', c => raw += c);
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')); }
      catch { reject(new Error('Invalid JSON')); }
    });
  });
}
function serveFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}
function nextId(arr) {
  return arr.length ? Math.max(...arr.map(x => x.id || 0)) + 1 : 1;
}

// ── Seed default data if DB is empty ──────────────────
function seedIfEmpty() {
  if (!fs.existsSync(DB_FILE)) {
    const seed = {
      books: [
        { id:1, title:"The Midnight Library", author:"Matt Haig",    price:14.99, cat:"Fiction",   rating:4.8, stock:"in",  badge:"bestseller", featured:1, coverText:"Between life and death" },
        { id:2, title:"Educated",             author:"Tara Westover", price:13.49, cat:"Memoir",    rating:4.7, stock:"in",  badge:"",           featured:1, coverText:"A memoir" },
        { id:3, title:"Project Hail Mary",    author:"Andy Weir",    price:15.99, cat:"Sci-Fi",    rating:4.9, stock:"in",  badge:"new",        featured:1, coverText:"One man. One mission." },
        { id:4, title:"Sapiens",              author:"Yuval N. Harari", price:17.99, cat:"History", rating:4.8, stock:"in",  badge:"",           featured:0, coverText:"Brief history of humankind" },
        { id:5, title:"Atomic Habits",        author:"James Clear",  price:16.99, cat:"Self-Help", rating:4.9, stock:"in",  badge:"bestseller", featured:0, coverText:"Tiny changes, remarkable results" },
        { id:6, title:"Dune",                 author:"Frank Herbert",price:13.99, cat:"Sci-Fi",    rating:4.8, stock:"out", badge:"",           featured:0, coverText:"Epic of a faraway world" },
      ],
      categories: ["All","Fiction","Memoir","Sci-Fi","History","Self-Help","Mystery","Poetry"],
      hero: {
        eyebrow: "Est. 2008 · London · Rare & Modern",
        title:   "Every Great Story\nBegins With a",
        em:      "Book",
        sub:     "Curated shelves of literary fiction, rare editions, and beloved classics.",
        btn1:    "Browse Collection",
        btn2:    "Our Story"
      },
      settings: { name:"Folio & Ink", currency:"$" },
      about:   "Founded in 2008 in a small London flat, Folio & Ink grew from a passion for the written word.",
      contact: "📍 14 Bloomsbury Lane, London\n📞 +44 20 7946 0921\n✉️ hello@folioandink.co.uk",
      orders:  [],
    };
    writeDB(seed);
    console.log('✅ Seeded default database → db.json');
  }
}

// ── Router ─────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const parsed   = url.parse(req.url, true);
  const pathname = parsed.pathname;
  const method   = req.method;

  // CORS preflight
  if (method === 'OPTIONS') { send(res, 200, {}); return; }

  // ── Serve index.html & static files ──────────────────
  if (method === 'GET' && pathname === '/') {
    serveFile(res, path.join(__dirname, 'index.html'), 'text/html'); return;
  }

  // ══════════════════════════════════════════════════
  //  API ROUTES
  // ══════════════════════════════════════════════════
  if (!pathname.startsWith('/api')) {
    send(res, 404, { error: 'Route not found' }); return;
  }

  const db = readDB();

  try {

    // ── BOOKS ─────────────────────────────────────────
    // GET /api/books  (optional ?cat=Fiction&featured=1&q=search)
    if (method === 'GET' && pathname === '/api/books') {
      let books = db.books;
      const { cat, featured, q, badge } = parsed.query;
      if (cat && cat !== 'All') books = books.filter(b => b.cat === cat);
      if (featured) books = books.filter(b => b.featured == 1);
      if (badge)    books = books.filter(b => b.badge === badge);
      if (q) {
        const lq = q.toLowerCase();
        books = books.filter(b => b.title.toLowerCase().includes(lq) || b.author.toLowerCase().includes(lq));
      }
      send(res, 200, books); return;
    }

    // GET /api/books/:id
    if (method === 'GET' && /^\/api\/books\/\d+$/.test(pathname)) {
      const id   = parseInt(pathname.split('/')[3]);
      const book = db.books.find(b => b.id === id);
      if (!book) { send(res, 404, { error: 'Book not found' }); return; }
      send(res, 200, book); return;
    }

    // POST /api/books  — Add new book
    if (method === 'POST' && pathname === '/api/books') {
      const data = await body(req);
      if (!data.title || !data.author || !data.price) {
        send(res, 400, { error: 'title, author, price are required' }); return;
      }
      const book = { id: nextId(db.books), ...data, createdAt: new Date().toISOString() };
      db.books.push(book);
      writeDB(db);
      send(res, 201, book); return;
    }

    // PUT /api/books/:id  — Update book
    if (method === 'PUT' && /^\/api\/books\/\d+$/.test(pathname)) {
      const id  = parseInt(pathname.split('/')[3]);
      const idx = db.books.findIndex(b => b.id === id);
      if (idx === -1) { send(res, 404, { error: 'Book not found' }); return; }
      const data = await body(req);
      db.books[idx] = { ...db.books[idx], ...data, updatedAt: new Date().toISOString() };
      writeDB(db);
      send(res, 200, db.books[idx]); return;
    }

    // DELETE /api/books/:id
    if (method === 'DELETE' && /^\/api\/books\/\d+$/.test(pathname)) {
      const id  = parseInt(pathname.split('/')[3]);
      const len = db.books.length;
      db.books   = db.books.filter(b => b.id !== id);
      if (db.books.length === len) { send(res, 404, { error: 'Book not found' }); return; }
      writeDB(db);
      send(res, 200, { success: true, message: 'Book deleted' }); return;
    }

    // ── CATEGORIES ────────────────────────────────────
    // GET /api/categories
    if (method === 'GET' && pathname === '/api/categories') {
      send(res, 200, db.categories); return;
    }
    // POST /api/categories
    if (method === 'POST' && pathname === '/api/categories') {
      const { name } = await body(req);
      if (!name) { send(res, 400, { error: 'name is required' }); return; }
      if (db.categories.includes(name)) { send(res, 409, { error: 'Already exists' }); return; }
      db.categories.push(name);
      writeDB(db);
      send(res, 201, { name }); return;
    }
    // DELETE /api/categories/:name
    if (method === 'DELETE' && pathname.startsWith('/api/categories/')) {
      const name = decodeURIComponent(pathname.split('/')[3]);
      db.categories = db.categories.filter(c => c !== name);
      writeDB(db);
      send(res, 200, { success: true }); return;
    }

    // ── HERO ──────────────────────────────────────────
    // GET /api/hero
    if (method === 'GET' && pathname === '/api/hero') {
      send(res, 200, db.hero || {}); return;
    }
    // PUT /api/hero
    if (method === 'PUT' && pathname === '/api/hero') {
      const data = await body(req);
      db.hero = { ...db.hero, ...data };
      writeDB(db);
      send(res, 200, db.hero); return;
    }

    // ── SETTINGS ──────────────────────────────────────
    // GET /api/settings
    if (method === 'GET' && pathname === '/api/settings') {
      send(res, 200, db.settings || {}); return;
    }
    // PUT /api/settings
    if (method === 'PUT' && pathname === '/api/settings') {
      const data = await body(req);
      db.settings = { ...db.settings, ...data };
      writeDB(db);
      send(res, 200, db.settings); return;
    }

    // ── PAGES ─────────────────────────────────────────
    // GET /api/pages/:page  (about | contact)
    if (method === 'GET' && pathname.startsWith('/api/pages/')) {
      const page = pathname.split('/')[3];
      send(res, 200, { content: db[page] || '' }); return;
    }
    // PUT /api/pages/:page
    if (method === 'PUT' && pathname.startsWith('/api/pages/')) {
      const page = pathname.split('/')[3];
      const { content } = await body(req);
      db[page] = content;
      writeDB(db);
      send(res, 200, { success: true, content }); return;
    }

    // ── ORDERS ────────────────────────────────────────
    // GET /api/orders
    if (method === 'GET' && pathname === '/api/orders') {
      send(res, 200, db.orders || []); return;
    }
    // POST /api/orders  — Place order
    if (method === 'POST' && pathname === '/api/orders') {
      const data  = await body(req);
      if (!data.items || !data.items.length) {
        send(res, 400, { error: 'items array is required' }); return;
      }
      const total = data.items.reduce((s, i) => s + i.price * i.qty, 0);
      const order = {
        id:        nextId(db.orders || []),
        items:     data.items,
        total:     parseFloat(total.toFixed(2)),
        customer:  data.customer || null,
        status:    'pending',
        createdAt: new Date().toISOString(),
      };
      if (!db.orders) db.orders = [];
      db.orders.push(order);
      writeDB(db);
      send(res, 201, order); return;
    }

    // ── STATS ─────────────────────────────────────────
    // GET /api/stats
    if (method === 'GET' && pathname === '/api/stats') {
      send(res, 200, {
        totalBooks:    db.books.length,
        featuredBooks: db.books.filter(b => b.featured == 1).length,
        categories:    db.categories.length,
        totalOrders:   (db.orders || []).length,
        revenue:       (db.orders || []).reduce((s, o) => s + o.total, 0).toFixed(2),
      }); return;
    }

    // Fallthrough
    send(res, 404, { error: 'API route not found' });

  } catch (err) {
    console.error('Server error:', err.message);
    send(res, 500, { error: 'Internal server error', detail: err.message });
  }
});

seedIfEmpty();
server.listen(PORT, () => {
  console.log(`\n📚 Folio & Ink Backend running!`);
  console.log(`   Frontend : http://localhost:${PORT}`);
  console.log(`   API Base : http://localhost:${PORT}/api`);
  console.log(`\n   Endpoints:`);
  console.log(`   GET/POST          /api/books`);
  console.log(`   GET/PUT/DELETE    /api/books/:id`);
  console.log(`   GET/POST/DELETE   /api/categories`);
  console.log(`   GET/PUT           /api/hero`);
  console.log(`   GET/PUT           /api/settings`);
  console.log(`   GET/PUT           /api/pages/:page`);
  console.log(`   GET/POST          /api/orders`);
  console.log(`   GET               /api/stats`);
  console.log(`\n   Press Ctrl+C to stop.\n`);
});
