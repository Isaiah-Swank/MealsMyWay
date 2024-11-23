const express = require('express');
const app = express();
const cors = require('cors');
const pool = require('./db');

// Middleware
app.use(cors()); // Allow requests from Ionic app
app.use(express.json()); // Parse JSON request bodies

// Example Routes
app.get('/', (req, res) => {
    res.send('Welcome to the Ionic App Backend!');
});

app.post('/data', (req, res) => {
    const { message } = req.body;
    res.json({ response: `Received: ${message}` });
});

/*
app.get('/users', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM users');
      res.json(result.rows); // Send the result as JSON
    } catch (err) {
      console.error('Error executing query', err.stack);
      res.status(500).send('Error retrieving data');
    }
  });
*/



// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});