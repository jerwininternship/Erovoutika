// Vercel Serverless Function for login
// Authenticates against Supabase and returns user data (without password)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

// Use service role key if available, otherwise fall back to anon key
const supabaseKey = supabaseServiceKey || supabaseAnonKey;
const supabase = supabaseKey
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  if (!supabase) {
    return res.status(500).json({ message: 'Server configuration error' });
  }

  const { identifier, password } = req.body || {};

  if (!identifier || !password) {
    return res.status(400).json({ message: 'Email/ID number and password are required' });
  }

  try {
    // Look up user by email or ID number
    const { data: userData, error } = await supabase
      .from('users')
      .select('id, id_number, email, password, full_name, role, profile_picture, created_at')
      .or(`email.eq.${identifier},id_number.eq.${identifier}`)
      .single();

    if (error || !userData) {
      return res.status(401).json({ message: 'Invalid email/ID number or password' });
    }

    // Verify password server-side
    if (userData.password !== password) {
      return res.status(401).json({ message: 'Invalid email/ID number or password' });
    }

    // Return user data WITHOUT password
    const safeUser = {
      id: userData.id,
      idNumber: userData.id_number,
      email: userData.email,
      fullName: userData.full_name,
      role: userData.role,
      profilePicture: userData.profile_picture,
      createdAt: userData.created_at,
    };

    return res.status(200).json(safeUser);
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
