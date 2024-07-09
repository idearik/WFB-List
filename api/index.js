const express = require('express');
const session = require('express-session');
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

let credentials;
try {
  credentials = JSON.parse(fs.readFileSync(path.join(__dirname, '../credentials.json'), 'utf8'));
} catch (error) {
  console.error('Error reading credentials file:', error);
  process.exit(1);
}

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});
const sheets = google.sheets({ version: 'v4', auth });

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Session configuration
app.use(session({
  secret: process.env.SECRET_KEY,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set to true if using HTTPS
}));

// Parse URL-encoded bodies and JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get('/', async (req, res) => {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: process.env.GOOGLE_SHEET_RANGE
    });

    const rows = response.data.values;
    const cafes = rows.slice(1).map(row => ({
      name: row[0],
      area: `📍 ${row[1]}`,
      hours: `⏰ ${row[2]}`,
      price: `💰 ${row[3]}`,
      speed: `🟢 ${row[4]} Mbps`,
      votes: parseInt(row[5] || '0', 10)
    }));

    // Sort cafes based on votes in descending order
    cafes.sort((a, b) => b.votes - a.votes);

    res.render('index', { cafes });
  } catch (error) {
    console.error('Error loading data from Google Sheets:', error);
    res.status(500).send('Error loading data from Google Sheets');
  }
});

app.post('/vote', async (req, res) => {
  const { cafeName } = req.body;

  // Check if user has already voted in this session
  if (req.session.voted && req.session.voted[cafeName]) {
    return res.status(400).json({ message: 'You have already voted for this cafe.' });
  }

  try {
    // Fetch current data
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: process.env.GOOGLE_SHEET_RANGE
    });

    const rows = response.data.values;
    const cafeIndex = rows.findIndex(row => row[0] === cafeName);

    if (cafeIndex !== -1) {
      // Update vote count in Google Sheets
      const currentVotes = parseInt(rows[cafeIndex][5] || '0', 10);
      const updatedVotes = currentVotes + 1;

      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        range: `Sheet1!G${cafeIndex + 2}`,
        valueInputOption: 'RAW',
        resource: { values: [[updatedVotes]] }
      });

      // Track votes in session
      req.session.voted = req.session.voted || {};
      req.session.voted[cafeName] = true;

      res.json({ message: 'Vote recorded.', votes: updatedVotes });
    } else {
      res.status(404).json({ message: 'Cafe not found.' });
    }
  } catch (error) {
    console.error('Error recording vote:', error);
    res.status(500).json({ message: 'Error recording vote' });
  }
});

// Export the app for Vercel to use
module.exports = app;
