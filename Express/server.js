const express = require('express');
const app = express();
const cors = require('cors');

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

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});