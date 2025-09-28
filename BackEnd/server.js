import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { connectDB } from './BackEnd/config/db.js';
import terminologyRoutes from './BackEnd/Routes/terminology.routes.js';

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));

app.get('/', (req, res) => res.send('SIH Terminology API. Try /health'));
app.use('/', terminologyRoutes);

const port = process.env.PORT || 4000;
connectDB().then(() => {
  app.listen(port, () => console.log(`✅ API running on http://localhost:${port}`));
}).catch(err => {
  console.error('❌ Mongo connect failed:', err.message);
  process.exit(1);
});
