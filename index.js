const express = require('express') 
const bodyParser = require('body-parser')
const websitetopdfRouter = require('./routes/websitetopdf');
const fs = require('fs');

const cors = require('cors');
const puppeteer = require('puppeteer');

const app = express();
const path = require('path');

app.get('/', (req, res) => {
  // Render your "index.ejs" file for the home page
  res.render('index'); // Assuming your EJS file is named "index.ejs"
});

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.urlencoded({ extended: true }));
app.set('views', path.join(__dirname, '/views'))
app.set('view engine', 'ejs')
app.use(express.static(path.join(__dirname, 'public')));
app.use(websitetopdfRouter);


app.listen(8080, () => {
  console.log('Server is running on port 8080');
});