import { Router } from 'express';
import vehicleRoutes from './vehicles.js';
import alertRoutes from './alerts.js';
import geofenceRoutes from './geofences.js';
import authRoutes from './auth.js';
import userRoutes from './users.js';
import contractRoutes from './contracts.js';
import clientRoutes from './clients.js';

const router = Router();

// Montage des routes
router.use('/auth', authRoutes);
router.use('/vehicles', vehicleRoutes);
router.use('/alerts', alertRoutes);
router.use('/geofences', geofenceRoutes);
router.use('/users', userRoutes);
router.use('/contracts', contractRoutes);
router.use('/clients', clientRoutes);

// Route de santé
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

export default router;
