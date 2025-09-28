import express from 'express';
import { health, suggest, fhirExpandAy, translateFhir, ingestBundle } from '../Controllers/terminology.controller.js';
import auth from '../Middleware/auth.js';

const router = express.Router();

router.get('/health', health);
router.get('/suggest', auth, suggest);
router.get('/fhir/ValueSet/namaste-ay/$expand', auth, fhirExpandAy);
router.get('/fhir/ValueSet/namaste-ay/expand-test', auth, fhirExpandAy);
router.post('/fhir/ConceptMap/$translate', auth, translateFhir);
router.post('/fhir/ConceptMap/translate-test', auth, translateFhir);
router.post('/ingest/bundle', auth, ingestBundle);

export default router;
