import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { connectDB } from './config/db.js';
import terminologyRoutes from './Routes/terminology_routes.js';
import authRoutes from './Routes/auth_routes.js'
import pateintRoutes from './Routes/pateints_routes.js'
import suggestRoutes from './Routes/suggest.js'
import fhirRoutes from "./Routes/api.js";
import api from "./Routes/api.js";
import suggestRoute from "./Routes/suggest.js"
dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));

app.get('/', (req, res) => res.send('SIH Terminology API. Try /health'));
app.use('/', terminologyRoutes);
app.use('/', authRoutes);
app.use('/', pateintRoutes);
app.use("/", api);
app.use("/api/suggest", suggestRoute);




const port = process.env.PORT || 4000;
connectDB().then(() => {
  app.listen(port, () => console.log(`✅ API running on http://localhost:${port}`));
}).catch(err => {
  console.error('❌ Mongo connect failed:', err.message);
  process.exit(1);
});
