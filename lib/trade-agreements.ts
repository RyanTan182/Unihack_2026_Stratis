/**
 * Global Trade Agreements Data
 *
 * Trade agreements organized by target market (EU, US, Asia) for relevance.
 * Works globally for manufacturers targeting any market.
 */

export interface TradeAgreementsByMarket {
  eu: string[]
  us: string[]
  asia: string[]
}

/**
 * Trade agreements for each country, organized by target market
 */
export const TRADE_AGREEMENTS: Record<string, TradeAgreementsByMarket> = {
  // EU Member States (full access)
  'Poland': { eu: ['EU Single Market', 'Schengen Area'], us: ['US-EU Trade (negotiating)'], asia: [] },
  'Germany': { eu: ['EU Single Market', 'Schengen Area'], us: ['US-EU Trade (negotiating)'], asia: [] },
  'France': { eu: ['EU Single Market', 'Schengen Area'], us: ['US-EU Trade (negotiating)'], asia: [] },
  'Netherlands': { eu: ['EU Single Market', 'Schengen Area'], us: ['US-EU Trade (negotiating)'], asia: [] },
  'Belgium': { eu: ['EU Single Market', 'Schengen Area'], us: ['US-EU Trade (negotiating)'], asia: [] },
  'Spain': { eu: ['EU Single Market', 'Schengen Area'], us: ['US-EU Trade (negotiating)'], asia: [] },
  'Italy': { eu: ['EU Single Market', 'Schengen Area'], us: ['US-EU Trade (negotiating)'], asia: [] },
  'Austria': { eu: ['EU Single Market', 'Schengen Area'], us: ['US-EU Trade (negotiating)'], asia: [] },
  'Sweden': { eu: ['EU Single Market', 'Schengen Area'], us: ['US-EU Trade (negotiating)'], asia: [] },
  'Denmark': { eu: ['EU Single Market', 'Schengen Area'], us: ['US-EU Trade (negotiating)'], asia: [] },
  'Finland': { eu: ['EU Single Market', 'Schengen Area'], us: ['US-EU Trade (negotiating)'], asia: [] },
  'Ireland': { eu: ['EU Single Market'], us: ['US-EU Trade (negotiating)'], asia: [] },
  'Portugal': { eu: ['EU Single Market', 'Schengen Area'], us: ['US-EU Trade (negotiating)'], asia: [] },
  'Greece': { eu: ['EU Single Market', 'Schengen Area'], us: ['US-EU Trade (negotiating)'], asia: [] },
  'Czech Republic': { eu: ['EU Single Market', 'Schengen Area'], us: ['US-EU Trade (negotiating)'], asia: [] },
  'Hungary': { eu: ['EU Single Market', 'Schengen Area'], us: ['US-EU Trade (negotiating)'], asia: [] },
  'Romania': { eu: ['EU Single Market'], us: ['US-EU Trade (negotiating)'], asia: [] },
  'Bulgaria': { eu: ['EU Single Market'], us: ['US-EU Trade (negotiating)'], asia: [] },

  // EU Partners (preferential access)
  'Vietnam': { eu: ['EVFTA - EU-Vietnam FTA'], us: [], asia: ['RCEP', 'CPTPP'] },
  'Malaysia': { eu: ['ASEAN-EU FTA (negotiating)'], us: [], asia: ['RCEP', 'CPTPP'] },
  'Thailand': { eu: ['ASEAN-EU FTA (negotiating)'], us: [], asia: ['RCEP'] },
  'Indonesia': { eu: ['ASEAN-EU FTA (negotiating)'], us: [], asia: ['RCEP'] },
  'Mexico': { eu: ['EU-Mexico FTA'], us: ['USMCA'], asia: ['CPTPP'] },
  'Turkey': { eu: ['EU Customs Union'], us: [], asia: [] },
  'South Korea': { eu: ['EU-Korea FTA'], us: ['KORUS FTA'], asia: ['RCEP'] },
  'Japan': { eu: ['EU-Japan EPA'], us: ['US-Japan Trade Agreement'], asia: ['RCEP', 'CPTPP'] },
  'Singapore': { eu: ['EU-Singapore FTA'], us: ['US-Singapore FTA'], asia: ['RCEP', 'CPTPP'] },
  'Canada': { eu: ['CETA'], us: ['USMCA'], asia: ['CPTPP'] },
  'Australia': { eu: ['EU-Australia FTA (negotiating)'], us: [], asia: ['RCEP', 'CPTPP'] },

  // Key trading partners
  'United States': { eu: ['US-EU Trade (negotiating)'], us: ['Domestic Market'], asia: ['Indo-Pacific Framework'] },
  'United Kingdom': { eu: ['EU-UK Trade Agreement'], us: ['US-UK Trade (negotiating)'], asia: ['CPTPP (accession)'] },
  'India': { eu: ['EU-India FTA (negotiating)'], us: [], asia: [] },
  'China': { eu: [], us: [], asia: ['RCEP'] },
  'Taiwan': { eu: [], us: [], asia: [] },
  'Brazil': { eu: ['EU-Mercosur (negotiating)'], us: [], asia: [] },
  'Argentina': { eu: ['EU-Mercosur (negotiating)'], us: [], asia: [] },
  'Chile': { eu: ['EU-Chile FTA'], us: [], asia: ['CPTPP'] },
  'Saudi Arabia': { eu: [], us: [], asia: [] },
  'South Africa': { eu: ['EU-South Africa FTA'], us: ['AGOA'], asia: [] },
  'Nigeria': { eu: [], us: ['AGOA'], asia: [] },
  'Egypt': { eu: ['EU-Egypt Association'], us: [], asia: [] },
  'Iran': { eu: [], us: ['Sanctions'], asia: [] },
  'Russia': { eu: ['Sanctions'], us: ['Sanctions'], asia: [] },
  'Ukraine': { eu: ['EU-Ukraine Association'], us: [], asia: [] },
  'Pakistan': { eu: ['GSP+'], us: [], asia: [] },
  'Bangladesh': { eu: ['GSP+'], us: [], asia: [] },
  'Peru': { eu: ['EU-Peru FTA'], us: ['US-Peru FTA'], asia: ['CPTPP'] },
}

/**
 * Labor cost index by country (0-100 scale, higher = more expensive)
 * Based on average manufacturing labor costs relative to US baseline
 */
export const LABOR_COST_INDEX: Record<string, number> = {
  'Switzerland': 98,
  'United States': 100,
  'Germany': 95,
  'Denmark': 94,
  'Belgium': 92,
  'Netherlands': 90,
  'France': 88,
  'Austria': 87,
  'Sweden': 86,
  'Japan': 85,
  'Finland': 84,
  'Ireland': 82,
  'Australia': 80,
  'Canada': 78,
  'United Kingdom': 76,
  'South Korea': 75,
  'Italy': 72,
  'Spain': 65,
  'Israel': 60,
  'New Zealand': 58,
  'Portugal': 50,
  'Czech Republic': 38,
  'Hungary': 36,
  'Poland': 35,
  'Slovakia': 34,
  'Greece': 33,
  'Romania': 30,
  'China': 30,
  'Turkey': 22,
  'Mexico': 28,
  'Malaysia': 25,
  'Thailand': 18,
  'Vietnam': 12,
  'Indonesia': 15,
  'Philippines': 14,
  'India': 10,
  'Bangladesh': 8,
  'Pakistan': 9,
  'Egypt': 18,
  'Brazil': 35,
  'Argentina': 32,
  'Chile': 30,
  'South Africa': 25,
  'Nigeria': 12,
  'Saudi Arabia': 40,
  'Iran': 20,
  'Russia': 25,
  'Ukraine': 15,
}

/**
 * Infrastructure rating by country
 */
export const INFRASTRUCTURE_RATING: Record<string, 'excellent' | 'good' | 'moderate' | 'developing'> = {
  'Singapore': 'excellent',
  'Netherlands': 'excellent',
  'Germany': 'excellent',
  'Japan': 'excellent',
  'South Korea': 'excellent',
  'United States': 'excellent',
  'Canada': 'excellent',
  'United Kingdom': 'excellent',
  'France': 'excellent',
  'Belgium': 'excellent',
  'Denmark': 'excellent',
  'Finland': 'excellent',
  'Sweden': 'excellent',
  'Austria': 'excellent',
  'Switzerland': 'excellent',
  'Australia': 'good',
  'Spain': 'good',
  'Italy': 'good',
  'Portugal': 'good',
  'Ireland': 'good',
  'Poland': 'good',
  'Czech Republic': 'good',
  'Hungary': 'good',
  'Mexico': 'moderate',
  'China': 'good',
  'Malaysia': 'good',
  'Thailand': 'moderate',
  'Vietnam': 'moderate',
  'Indonesia': 'moderate',
  'Philippines': 'moderate',
  'India': 'moderate',
  'Turkey': 'moderate',
  'Brazil': 'moderate',
  'Argentina': 'moderate',
  'Chile': 'good',
  'South Africa': 'moderate',
  'Egypt': 'moderate',
  'Saudi Arabia': 'good',
  'Iran': 'moderate',
  'Russia': 'moderate',
  'Ukraine': 'developing',
  'Bangladesh': 'developing',
  'Pakistan': 'developing',
  'Nigeria': 'developing',
  'Peru': 'moderate',
  'Romania': 'moderate',
  'Greece': 'good',
  'Taiwan': 'excellent',
}

/**
 * Major ports by country
 */
export const MAJOR_PORTS: Record<string, string[]> = {
  'Singapore': ['Singapore Port'],
  'Netherlands': ['Rotterdam', 'Amsterdam'],
  'Germany': ['Hamburg', 'Bremerhaven'],
  'China': ['Shanghai', 'Shenzhen', 'Ningbo', 'Qingdao'],
  'Japan': ['Tokyo', 'Yokohama', 'Kobe', 'Nagoya'],
  'South Korea': ['Busan', 'Incheon'],
  'United States': ['Los Angeles', 'Long Beach', 'New York/New Jersey', 'Seattle'],
  'Canada': ['Vancouver', 'Montreal'],
  'Mexico': ['Lazaro Cardenas', 'Manzanillo'],
  'Vietnam': ['Ho Chi Minh City', 'Hai Phong'],
  'Malaysia': ['Port Klang', 'Tanjung Pelepas'],
  'Thailand': ['Laem Chabang', 'Bangkok'],
  'Indonesia': ['Jakarta', 'Surabaya'],
  'India': ['Mumbai', 'Chennai', 'Kolkata'],
  'Turkey': ['Istanbul', 'Mersin'],
  'Brazil': ['Santos', 'Rio de Janeiro'],
  'United Kingdom': ['Felixstowe', 'Southampton', 'London'],
  'France': ['Le Havre', 'Marseille'],
  'Spain': ['Valencia', 'Barcelona', 'Algeciras'],
  'Italy': ['Genoa', 'Gioia Tauro'],
  'Belgium': ['Antwerp', 'Zeebrugge'],
  'Australia': ['Sydney', 'Melbourne', 'Brisbane'],
}

/**
 * Get trade agreements for a country and target market
 */
export function getTradeAgreements(country: string, targetMarket: 'eu' | 'us' | 'asia'): string[] {
  return TRADE_AGREEMENTS[country]?.[targetMarket] ?? []
}

/**
 * Get all trade agreements for a country across all markets
 */
export function getAllTradeAgreements(country: string): TradeAgreementsByMarket {
  return TRADE_AGREEMENTS[country] ?? { eu: [], us: [], asia: [] }
}

/**
 * Get labor cost index for a country
 */
export function getLaborCostIndex(country: string): number {
  return LABOR_COST_INDEX[country] ?? 50 // Default to medium cost
}

/**
 * Get infrastructure rating for a country
 */
export function getInfrastructureRating(country: string): 'excellent' | 'good' | 'moderate' | 'developing' {
  return INFRASTRUCTURE_RATING[country] ?? 'moderate'
}

/**
 * Get market access level for a country and target market
 */
export function getMarketAccess(country: string, targetMarket: 'eu' | 'us' | 'asia'): 'excellent' | 'good' | 'moderate' | 'limited' {
  const agreements = getTradeAgreements(country, targetMarket)

  if (agreements.some(a => a.includes('Single Market') || a.includes('Customs Union') || a.includes('Domestic'))) {
    return 'excellent'
  }
  if (agreements.some(a => a.includes('FTA') || a.includes('EPA') || a.includes('CETA') || a.includes('USMCA') || a.includes('RCEP') || a.includes('CPTPP'))) {
    return 'good'
  }
  if (agreements.some(a => a.includes('negotiating') || a.includes('GSP'))) {
    return 'moderate'
  }
  if (agreements.some(a => a.includes('Sanctions'))) {
    return 'limited'
  }
  return 'moderate'
}
