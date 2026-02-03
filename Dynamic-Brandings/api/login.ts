// Vercel Serverless Function for login
// Note: This is a placeholder - actual auth is handled client-side via Supabase
// This endpoint exists to prevent 405 errors on Vercel

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // On Vercel, authentication is handled client-side via Supabase
  // This endpoint returns success to maintain compatibility
  // The actual session is managed via localStorage on the client
  return res.status(200).json({ message: 'OK' });
}
