/**
 * Deterministic Database and Entity Fixtures for Testing
 */

export const MOCK_API_KEYS = [
  {
    id: 'key_primary_01',
    key: 'AIzaSyA_mock_primary_pool_key_active_01',
    alias: 'Admin Pool Primary 01',
    status: 'active' as const,
    dailyLimit: 1000,
    dailyUsage: 150,
    monthlyLimit: 30000,
    monthlyUsage: 4500,
    cooldownUntil: 0,
    lastTestedLatency: 180,
    verifiedByAdmin: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    lastUsedAt: '2026-09-23T07:00:00.000Z'
  },
  {
    id: 'key_secondary_02',
    key: 'AIzaSyB_mock_secondary_pool_key_active_02',
    alias: 'Admin Pool Secondary 02',
    status: 'active' as const,
    dailyLimit: 1000,
    dailyUsage: 300,
    monthlyLimit: 30000,
    monthlyUsage: 6000,
    cooldownUntil: 0,
    lastTestedLatency: 220,
    verifiedByAdmin: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    lastUsedAt: '2026-09-23T07:00:00.000Z'
  },
  {
    id: 'key_cooling_03',
    key: 'AIzaSyC_mock_cooling_pool_key_03',
    alias: 'Admin Pool Cooldown Key',
    status: 'rate_limited' as const,
    dailyLimit: 1000,
    dailyUsage: 990,
    monthlyLimit: 30000,
    monthlyUsage: 25000,
    cooldownUntil: Date.now() + 180000, // 3 minutes in future
    lastTestedLatency: 450,
    verifiedByAdmin: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    lastUsedAt: '2026-09-23T07:30:00.000Z'
  },
  {
    id: 'key_revoked_04',
    key: 'AIzaSyD_mock_revoked_key_04',
    alias: 'Revoked Pool Key',
    status: 'revoked' as const,
    dailyLimit: 1000,
    dailyUsage: 0,
    monthlyLimit: 30000,
    monthlyUsage: 120,
    cooldownUntil: 0,
    lastTestedLatency: 0,
    verifiedByAdmin: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    lastUsedAt: '2026-09-20T00:00:00.000Z'
  }
];

export const MOCK_CLIENTS = [
  {
    id: 'client_active_vip',
    clientCode: 'SATSET-VIP-888',
    name: 'Sultan Creator VIP',
    status: 'active' as const,
    packageId: 'pkg_vip_pro',
    packageName: 'Sultan VIP Tahunan',
    expiryDate: '2027-01-01T00:00:00.000Z',
    dailyLimit: 500,
    dailyUsage: 45,
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'client_expired',
    clientCode: 'SATSET-EXP-001',
    name: 'Expired Client Test',
    status: 'expired' as const,
    packageId: 'pkg_starter_7d',
    packageName: 'Starter 7 Hari',
    expiryDate: '2026-01-01T00:00:00.000Z',
    dailyLimit: 50,
    dailyUsage: 10,
    createdAt: '2025-12-01T00:00:00.000Z'
  }
];

export const MOCK_PACKAGES = [
  {
    id: 'pkg_starter_7d',
    name: 'Paket Starter 7 Hari',
    price: 49000,
    durationDays: 7,
    dailyLimit: 50,
    isActive: true,
    features: ['Akses Semua Tool AI', 'Support Standar']
  },
  {
    id: 'pkg_vip_pro',
    name: 'Sultan VIP Tahunan',
    price: 499000,
    durationDays: 365,
    dailyLimit: 500,
    isActive: true,
    features: ['Akses Semua Tool AI', 'Prioritas Render Kilat', 'Support VIP 24/7']
  }
];

export const MOCK_PAYMENTS = [
  {
    id: 'ORD-2026-0923-001',
    orderId: 'ORD-2026-0923-001',
    clientCode: 'SATSET-VIP-888',
    packageId: 'pkg_starter_7d',
    amount: 49123,
    status: 'pending' as const,
    paymentMethod: 'qris',
    createdAt: '2026-09-23T07:00:00.000Z'
  },
  {
    id: 'ORD-2026-0923-002',
    orderId: 'ORD-2026-0923-002',
    clientCode: 'SATSET-VIP-888',
    packageId: 'pkg_vip_pro',
    amount: 499456,
    status: 'paid' as const,
    paymentMethod: 'bca_transfer',
    createdAt: '2026-09-23T06:00:00.000Z',
    paidAt: '2026-09-23T06:15:00.000Z'
  }
];
