const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const app = express();
const PORT = 3000;

/* ================= OWNER CREDENTIALS ================= */
const OWNER_EMAIL = "saianiluppu@gmail.com";
const OWNER_PASSWORD = "12345";

/* ================= MIDDLEWARE ================= */
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
  session({
    secret: "box_cricket_secret_key",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(express.static(path.join(__dirname, "public")));

function yyyyMMddToDdMmYyyy(dateStr) {
  const [y, m, d] = dateStr.split("-");
  return `${d}-${m}-${y}`;
}


/* ================= FILE PATHS ================= */
const DATA_DIR = path.join(__dirname, "data");
const BOOKINGS_FILE = path.join(DATA_DIR, "bookings.xlsx");
const EXPENSES_FILE = path.join(DATA_DIR, "expenses.xlsx");

/* ================= ENSURE DATA FOLDER ================= */
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/* ================= EXCEL HELPERS (SAFE) ================= */
function readExcel(filePath, sheetName) {
  if (!fs.existsSync(filePath)) return [];
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet);
}

function writeExcel(filePath, sheetName, data) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  XLSX.writeFile(workbook, filePath);
}

function calculateAmount(startTime, endTime) {
  const RATE_BEFORE_6 = 400;
  const RATE_AFTER_6 = 500;
  const SIX_PM = 18 * 60;

  const toMinutes = (t) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  const start = toMinutes(startTime);
  const end = toMinutes(endTime);

  let total = 0;

  // Before 6 PM
  if (start < SIX_PM) {
    const beforeEnd = Math.min(end, SIX_PM);
    total += Math.max(0, beforeEnd - start) / 60 * RATE_BEFORE_6;
  }

  // After 6 PM
  if (end > SIX_PM) {
    const afterStart = Math.max(start, SIX_PM);
    total += Math.max(0, end - afterStart) / 60 * RATE_AFTER_6;
  }

  return Math.round(total);
}

/* ================= TIME HELPERS ================= */
function timeToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function rangesOverlap(s1, e1, s2, e2) {
  return timeToMinutes(s1) < timeToMinutes(e2) &&
         timeToMinutes(s2) < timeToMinutes(e1);
}

/* ================= OWNER AUTH ================= */
function requireOwner(req, res, next) {
  if (!req.session.isOwner) {
    return res.status(401).json({ error: "Owner authentication required" });
  }
  next();
}

/* ================= ROUTES ================= */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* ================= AVAILABILITY API ================= */
app.get("/api/availability", (req, res) => {
  const date = req.query.date;
  if (!date) return res.json([]);

  const OPEN = 6;
  const CLOSE = 23;

  const allSlots = [];
  for (let h = OPEN; h < CLOSE; h++) {
    allSlots.push({
      start: `${String(h).padStart(2, "0")}:00`,
      end: `${String(h + 1).padStart(2, "0")}:00`,
    });
  }

  const bookings = readExcel(BOOKINGS_FILE, "Bookings")
    .filter(b => b.Date === date);

  const available = allSlots.filter(slot =>
    !bookings.some(b =>
      rangesOverlap(slot.start, slot.end, b.StartTime, b.EndTime)
    )
  );

  res.json(available);
});

/* ================= BOOK SLOT ================= */
app.post("/api/book-slot", (req, res) => {
  const { customerName, phone, email, date, startTime, endTime } = req.body;

  if (!customerName || !phone || !email || !date || !startTime || !endTime) {
    return res.status(400).json({ error: "All fields are required" });
  }

  if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
    return res.status(400).json({ error: "Invalid time range" });
  }

  const bookings = readExcel(BOOKINGS_FILE, "Bookings")
    .filter(b => b.Date === date);

  const conflict = bookings.find(b =>
    rangesOverlap(startTime, endTime, b.StartTime, b.EndTime)
  );

  if (conflict) {
    return res.status(400).json({
      error: `Slot overlaps with ${conflict.StartTime} - ${conflict.EndTime}`,
    });
  }

  // ✅ CALCULATE AMOUNT HERE
  const amount = calculateAmount(startTime, endTime);

  const allBookings = readExcel(BOOKINGS_FILE, "Bookings");

  allBookings.push({
    BookingID: Date.now().toString(),
    CustomerName: customerName,
    Phone: phone,
    Email: email,
    Date: date,
    StartTime: startTime,
    EndTime: endTime,
    Amount: amount,          // ✅ STORED
    CreatedAt: new Date().toISOString(),
  });

  writeExcel(BOOKINGS_FILE, "Bookings", allBookings);

  res.json({
    message: "Slot booked successfully",
    amount,
  });
});


/* ================= OWNER LOGIN ================= */
app.post("/api/owner/login", (req, res) => {
  const { email, password } = req.body;

  if (
    email?.toLowerCase() === OWNER_EMAIL.toLowerCase() &&
    password === OWNER_PASSWORD
  ) {
    req.session.isOwner = true;
    return res.json({ message: "Login successful" });
  }

  res.status(401).json({ error: "Invalid credentials" });
});

app.post("/api/owner/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ message: "Logged out" });
  });
});

/* ================= OWNER APIs ================= */
app.get("/api/owner/bookings", requireOwner, (req, res) => {
  const { date } = req.query;
  const bookings = readExcel(BOOKINGS_FILE, "Bookings");

  if (!date) {
    return res.json(bookings);
  }

  const formattedDate = yyyyMMddToDdMmYyyy(date);

  const result = bookings.filter(
    (b) => String(b.Date).trim() === formattedDate
  );

  res.json(result);
});


app.get("/api/owner/expenses", requireOwner, (req, res) => {
  res.json(readExcel(EXPENSES_FILE, "Expenses"));
});

app.post("/api/owner/add-expense", requireOwner, (req, res) => {
  const { item, category, amount, notes } = req.body;

  if (!item || !category || !amount) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const expenses = readExcel(EXPENSES_FILE, "Expenses");

  expenses.push({
    ExpenseID: Date.now().toString(),
    Item: item,
    Category: category,
    Amount: Number(amount),
    Notes: notes || "",
    CreatedAt: new Date().toISOString(),
  });

  writeExcel(EXPENSES_FILE, "Expenses", expenses);

  res.json({ message: "Expense added" });
});

/* ================= DOWNLOAD ================= */
app.get("/download/bookings", requireOwner, (req, res) => {
  if (!fs.existsSync(BOOKINGS_FILE)) return res.send("No bookings yet");
  res.download(BOOKINGS_FILE);
});

app.get("/download/expenses", requireOwner, (req, res) => {
  if (!fs.existsSync(EXPENSES_FILE)) return res.send("No expenses yet");
  res.download(EXPENSES_FILE);
});

/* ================= OWNER DASHBOARD ================= */
app.get("/owner-dashboard", (req, res) => {
  if (!req.session.isOwner) return res.redirect("/owner-login.html");
  res.sendFile(path.join(__dirname, "public", "owner-dashboard.html"));
});

/* ================= START SERVER ================= */
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
