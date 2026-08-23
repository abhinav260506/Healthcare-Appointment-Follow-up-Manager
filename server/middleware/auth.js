import jwt from 'jsonwebtoken';
import { db } from '../db/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-health-jwt-key';

/**
 * Authentication Middleware: Validates JWT Bearer Token
 */
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'UNAUTHORIZED: Authentication token required.' });
  }

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'FORBIDDEN: Token is invalid or expired. Please sign in again.' });
    }

    try {
      const user = await db.queryOne(`SELECT * FROM users WHERE id = $1`, [decoded.id]);
      if (!user || user.status === 'SUSPENDED' || user.status === 'DISABLED') {
        return res.status(403).json({ error: 'FORBIDDEN: User account is inactive or suspended.' });
      }

      let doctorProfile = null;
      if (user.role === 'doctor') {
        doctorProfile = await db.queryOne(`SELECT * FROM doctors WHERE user_id = $1`, [user.id]);
      }

      req.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        doctorId: doctorProfile ? doctorProfile.id : null
      };
      next();
    } catch (dbErr) {
      res.status(500).json({ error: dbErr.message });
    }
  });
}

/**
 * Role-Based Access Control (RBAC) Middleware: Enforces Role Authorization
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED: Please sign in first.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `403 FORBIDDEN: Access Denied. Your account role (${req.user.role.toUpperCase()}) is not authorized to access this resource. Required role: ${allowedRoles.join(' or ').toUpperCase()}.`
      });
    }

    next();
  };
}
