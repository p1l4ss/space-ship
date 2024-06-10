const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');

const JWT_SECRET = "secret";
const PORT = 8080;
const USERS_FILE = path.join(__dirname, 'users.json');

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true })); 
app.use(express.static('public'));
app.use(cookieParser());

app.set('view engine', 'pug');
app.set('views', 'client');

const readUsers = () => {
  try {
    const data = fs.readFileSync(USERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading users file:', err);
    return [];
  }
};

const writeUsers = (users) => {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (err) {
    console.error('Error writing to users file:', err);
  }
};

const authenticateToken = (req, res, next) => {
  const token = req.cookies.jwt;
  if (!token) {
    return res.redirect('/');
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.redirect('/');
    }
    req.user = user;
    next();
  });
};

// Routes
app.get('/', (req, res, next) => {
  res.render('index');
});

app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  console.log('Received registration data:', req.body); // Log the request body

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const users = readUsers();
    const existingUser = users.find(user => user.email === email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    console.log('Hashing password:', password); // Log the password before hashing

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = { username, email, password: hashedPassword };
    users.push(newUser);
    writeUsers(users);

    // Automatically log the user in after registration
    const token = jwt.sign({ id: newUser.email }, JWT_SECRET, { expiresIn: '1h' });
    res.cookie('jwt', token, { httpOnly: true });
    res.redirect('/game');
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const users = readUsers();
    const user = users.find(user => user.email === email);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(403).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.email }, JWT_SECRET, { expiresIn: '1h' });
    res.cookie('jwt', token, { httpOnly: true });
    res.redirect('/game');
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/game', authenticateToken, (req, res) => {
  res.render('game');
});

// Profile Routes
app.get('/profile', authenticateToken, (req, res) => {
  const users = readUsers();
  const user = users.find(user => user.email === req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.render('profile', { user });
});

app.get('/profile/edit', authenticateToken, (req, res) => {
  const users = readUsers();
  const user = users.find(user => user.email === req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.render('edit-profile', { user });
});

app.post('/profile/edit', authenticateToken, async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email) {
    return res.status(400).json({ error: 'Username and email are required' });
  }

  try {
    const users = readUsers();
    const userIndex = users.findIndex(user => user.email === req.user.id);
    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updatedUser = { ...users[userIndex], username, email };

    if (password) {
      updatedUser.password = await bcrypt.hash(password, 10);
    }

    users[userIndex] = updatedUser;
    writeUsers(users);

    res.redirect('/profile');
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/logout', (req, res) => {
  res.clearCookie('jwt');
  res.redirect('/');
});

// Start server
app.listen(PORT, (err) => {
  if (err) {
    throw new Error(err);
  }
  console.log(`Listening to port ${PORT}`);
});
