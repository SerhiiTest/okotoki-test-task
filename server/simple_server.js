import express from 'express';

const app = express();
const PORT = 80;

app.use(express.static('client/public'));
app.use(express.static('client/dist'));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});