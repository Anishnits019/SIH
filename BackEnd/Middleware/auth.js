export default function auth(req, res, next) {
  const h = req.headers.authorization || '';
  if (!h.toLowerCase().startsWith('bearer ')) {
    return res.status(401).json({ error: 'Missing Bearer token' });
  }
  const token = h.split(' ')[1];
  if (!token || token.length < 8) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  req.abha = { sub: `ABHA-${token.slice(0,4)}***` };
  next();
}
