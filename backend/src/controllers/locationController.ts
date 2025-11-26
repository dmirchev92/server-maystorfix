// @ts-nocheck
import { Request, Response } from 'express';
import { DatabaseFactory } from '../models/DatabaseFactory';
import logger from '../utils/logger';

/**
 * Get all cities
 */
export const getCities = async (req: Request, res: Response) => {
  try {
    const db = DatabaseFactory.getDatabase();
    
    const cities = await db.query(`
      SELECT 
        id, geoname_id, name, name_bg, latitude, longitude, population
      FROM locations 
      WHERE type = 'city' AND is_active = true
      ORDER BY population DESC, name_bg ASC
    `);
    
    logger.info('📍 getCities - Fetched cities:', { count: cities.length });
    
    res.json({
      success: true,
      data: {
        cities: cities.map((city: any) => ({
          value: city.name_bg || city.name,
          label: city.name_bg || city.name,
          name: city.name,
          nameBg: city.name_bg,
          latitude: parseFloat(city.latitude),
          longitude: parseFloat(city.longitude),
          population: city.population,
          geonameId: city.geoname_id
        }))
      }
    });
  } catch (error) {
    logger.error('❌ getCities error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch cities' }
    });
  }
};

/**
 * Get neighborhoods for a specific city
 */
export const getNeighborhoods = async (req: Request, res: Response) => {
  try {
    const { city } = req.params;
    const db = DatabaseFactory.getDatabase();
    
    if (!city) {
      return res.status(400).json({
        success: false,
        error: { message: 'City parameter is required' }
      });
    }
    
    // Map Bulgarian city names to English for parent_city lookup
    const cityMapping: Record<string, string> = {
      'София': 'Sofia',
      'Пловдив': 'Plovdiv',
      'Варна': 'Varna',
      'Бургас': 'Burgas',
    };
    
    const parentCity = cityMapping[city] || city;
    
    const neighborhoods = await db.query(`
      SELECT 
        id, geoname_id, name, name_bg, latitude, longitude
      FROM locations 
      WHERE type = 'neighborhood' 
        AND is_active = true
        AND (parent_city = $1 OR parent_city = $2)
      ORDER BY name_bg ASC, name ASC
    `, [city, parentCity]);
    
    logger.info('📍 getNeighborhoods - Fetched neighborhoods:', { city, count: neighborhoods.length });
    
    res.json({
      success: true,
      data: {
        city,
        neighborhoods: neighborhoods.map((n: any) => ({
          value: n.name_bg || n.name,
          label: n.name_bg || n.name,
          name: n.name,
          nameBg: n.name_bg,
          latitude: n.latitude ? parseFloat(n.latitude) : null,
          longitude: n.longitude ? parseFloat(n.longitude) : null,
          geonameId: n.geoname_id
        }))
      }
    });
  } catch (error) {
    logger.error('❌ getNeighborhoods error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch neighborhoods' }
    });
  }
};

/**
 * Search locations (cities and neighborhoods)
 */
export const searchLocations = async (req: Request, res: Response) => {
  try {
    const { q, type } = req.query;
    const db = DatabaseFactory.getDatabase();
    
    if (!q || typeof q !== 'string' || q.length < 2) {
      return res.status(400).json({
        success: false,
        error: { message: 'Search query must be at least 2 characters' }
      });
    }
    
    const searchTerm = `%${q}%`;
    let query = `
      SELECT 
        id, geoname_id, name, name_bg, type, parent_city, latitude, longitude
      FROM locations 
      WHERE is_active = true
        AND (name ILIKE $1 OR name_bg ILIKE $1)
    `;
    const params: any[] = [searchTerm];
    
    if (type && (type === 'city' || type === 'neighborhood')) {
      query += ` AND type = $2`;
      params.push(type);
    }
    
    query += ` ORDER BY population DESC, name_bg ASC LIMIT 20`;
    
    const locations = await db.query(query, params);
    
    logger.info('📍 searchLocations - Search results:', { query: q, count: locations.length });
    
    res.json({
      success: true,
      data: {
        locations: locations.map((loc: any) => ({
          value: loc.name_bg || loc.name,
          label: loc.type === 'neighborhood' 
            ? `${loc.name_bg || loc.name}, ${loc.parent_city}`
            : (loc.name_bg || loc.name),
          name: loc.name,
          nameBg: loc.name_bg,
          type: loc.type,
          parentCity: loc.parent_city,
          latitude: loc.latitude ? parseFloat(loc.latitude) : null,
          longitude: loc.longitude ? parseFloat(loc.longitude) : null,
          geonameId: loc.geoname_id
        }))
      }
    });
  } catch (error) {
    logger.error('❌ searchLocations error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to search locations' }
    });
  }
};

/**
 * Get all locations (for initial load/caching)
 */
export const getAllLocations = async (req: Request, res: Response) => {
  try {
    const db = DatabaseFactory.getDatabase();
    
    const [cities, neighborhoods] = await Promise.all([
      db.query(`
        SELECT id, geoname_id, name, name_bg, latitude, longitude, population
        FROM locations 
        WHERE type = 'city' AND is_active = true
        ORDER BY population DESC, name_bg ASC
      `),
      db.query(`
        SELECT id, geoname_id, name, name_bg, parent_city, latitude, longitude
        FROM locations 
        WHERE type = 'neighborhood' AND is_active = true
        ORDER BY parent_city, name_bg ASC
      `)
    ]);
    
    // Group neighborhoods by city
    const neighborhoodsByCity: Record<string, any[]> = {};
    neighborhoods.forEach((n: any) => {
      const city = n.parent_city || 'Other';
      if (!neighborhoodsByCity[city]) {
        neighborhoodsByCity[city] = [];
      }
      neighborhoodsByCity[city].push({
        value: n.name_bg || n.name,
        label: n.name_bg || n.name,
        name: n.name,
        nameBg: n.name_bg,
        latitude: n.latitude ? parseFloat(n.latitude) : null,
        longitude: n.longitude ? parseFloat(n.longitude) : null
      });
    });
    
    logger.info('📍 getAllLocations - Fetched all locations:', { 
      cities: cities.length, 
      neighborhoods: neighborhoods.length 
    });
    
    res.json({
      success: true,
      data: {
        cities: cities.map((city: any) => ({
          value: city.name_bg || city.name,
          label: city.name_bg || city.name,
          name: city.name,
          nameBg: city.name_bg,
          latitude: parseFloat(city.latitude),
          longitude: parseFloat(city.longitude),
          population: city.population
        })),
        neighborhoodsByCity
      }
    });
  } catch (error) {
    logger.error('❌ getAllLocations error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch locations' }
    });
  }
};
