const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth',     require('./routes/auth'));
app.use('/api/orders',   require('./routes/orders'));
app.use('/api/pickers',  require('./routes/pickers'));
app.use('/api/checkers', require('./routes/checkers'));

app.get('/api/health', (req, res) => res.json({ status: 'API is running ✅' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));