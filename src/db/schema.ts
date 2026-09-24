// ============================================================================
// Firebase Firestore Database Schema & Typed Document Definitions
// ============================================================================

export const FIRESTORE_COLLECTIONS = {
  USERS: 'users',
  CLIENTS: 'clients',
  PACKAGES: 'packages',
  TRANSACTIONS: 'transactions',
  CONFIGS: 'configs',
  API_KEYS: 'apiKeys',
  API_KEY_LOGS: 'apiKeyLogs',
  AI_AGENTS: 'aiAgents',
  AUDIT_LOGS: 'auditLogs',
  LEARNING_QUEUE: 'learningQueue',
  CATEGORY_TAXONOMY: 'categoryTaxonomy',
  CATEGORY_TAXONOMY_PROPOSALS: 'categoryTaxonomyProposals',
  TRACKING_EVENTS: 'trackingEvents',
  ACCESS_CODES: 'accessCodes',
  BANNED_DEVICES: 'bannedDevices',
  PENDING_SCHEMA_CHANGES: 'pendingSchemaChanges',
  HISTORY: 'history',
  HEALTH_CHECK: '_healthCheck',
} as const;

export type FirestoreCollectionName = typeof FIRESTORE_COLLECTIONS[keyof typeof FIRESTORE_COLLECTIONS];

// --- User Profile Document ---
export interface UserDoc {
  uid: string;
  email: string;
  name?: string | null;
  role?: 'user' | 'admin' | 'vip' | 'superadmin';
  accessCode?: string | null;
  createdAt: string;
  updatedAt: string;
}

// --- Client Access Document ---
export interface ClientDoc {
  id: string;
  accessCode: string;
  name: string;
  whatsapp?: string;
  email?: string;
  packageId: string;
  packageName: string;
  price: number;
  startDate: string;
  expiryDate: string;
  status: 'active' | 'expiring_soon' | 'expired' | 'suspended';
  type?: string;
  lastLoginAt?: string;
  toolUsage?: string | Record<string, number>;
  notes?: string;
  createdAt: string;
}

// --- Package & Subscription Tier Document ---
export interface PackageDoc {
  id: string;
  name: string;
  tagline?: string;
  price: number;
  durationDays: number;
  features: string[] | string;
  isPopular?: boolean;
  isActive?: boolean;
  badgeLabel?: string;
  targetCategory?: string;
  updatedAt?: string;
}

// --- Transaction & Payment Verification Document ---
export interface TransactionDoc {
  id: string; // e.g. TRX-XXXXXX-SAT
  customerName: string;
  whatsapp: string;
  email: string;
  planId: string;
  planName: string;
  packageName?: string;
  planPrice: number;
  serviceFee?: number;
  totalPrice: number;
  amount: number;
  status: 'PENDING_PROOF' | 'AWAITING_VERIFICATION' | 'APPROVED' | 'REJECTED';
  proofImageBase64?: string;
  paymentProofBase64?: string;
  accessCode?: string;
  validUntil?: string;
  createdAt: number;
  updatedAt: number;
  note?: string;
  rejectReason?: string;
}

// --- QRIS & Payment Configuration Document ---
export interface QrisConfigDoc {
  imageBase64: string;
  merchantName: string;
  updatedAt?: string;
}

// --- Contact & CS Settings Document ---
export interface ContactSettingsDoc {
  whatsappNumber: string;
  whatsappTemplate: string;
  updatedAt?: string;
}

// --- API Key Pool Document ---
export interface ApiKeyDoc {
  id: string;
  key: string;
  alias?: string;
  dailyLimit?: number;
  dailyUsage?: number;
  monthlyLimit?: number;
  monthlyUsage?: number;
  status?: 'active' | 'expired' | 'revoked';
  expiryDate?: string;
  createdAt: string;
  lastUsedAt?: string;
  accessCode?: string;
}

// --- API Key Execution Log Document ---
export interface ApiKeyLogDoc {
  id: string;
  keyId: string;
  keyMasked: string;
  endpoint: string;
  status: string;
  modelUsed?: string;
  timestamp: string;
}

// --- System Audit Log Document ---
export interface AuditLogDoc {
  id: string;
  adminName: string;
  action: string;
  details: string;
  category: string;
  timestamp: string;
}

// --- AI Agent Registry Document ---
export interface AiAgentDoc {
  id: string;
  name: string;
  role: string;
  model: string;
  status: 'active' | 'paused' | 'standby';
  callsCount?: number;
  lastUsed?: string;
  approvedPatternsCount?: number;
  rejectedPatternsCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

// --- Self-Learning Pattern Queue Document ---
export interface LearningQueueDoc {
  id: string;
  sourceSubmissionId?: string;
  sourceUrl?: string;
  clientName?: string;
  patternCategory: 'hook' | 'pacing' | 'formula' | 'category';
  patternName: string;
  description: string;
  confidence: number;
  extractedByAgentId: string;
  extractedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  editedDescription?: string;
}

// --- System Memory & Continuous Evolution Document ---
export interface SystemMemoryDoc {
  totalExecutions: number;
  successfulPromptsCount: number;
  learnedKnowledgeBase: string[];
  viralHookPatterns: Array<{
    id: string;
    pattern: string;
    category: string;
    confidence: number;
  }>;
  categoryUsage: Record<string, number>;
  formulas: string[];
  lastUpdated: string;
}

// --- Tracking & Analytic Events Document ---
export interface TrackingEventDoc {
  id: string;
  eventType: string;
  userId?: string;
  accessCode?: string;
  toolName?: string;
  payload?: any;
  createdAt: string;
}

// --- Category Taxonomy Document ---
export interface CategoryTaxonomyDoc {
  id: string;
  name: string;
  keywords: string[];
  requiresManualReview?: boolean;
  parentId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// --- Category Taxonomy Proposal Document ---
export interface CategoryProposalDoc {
  id: string;
  proposedId: string;
  name: string;
  keywords: string[];
  suggestedParentId?: string | null;
  reason?: string;
  confidence: number;
  status: 'pending' | 'approved' | 'rejected';
  requiresManualReview?: boolean;
  proposedByAgentId?: string;
  createdAt: string;
  updatedAt?: string;
}

// --- Access Codes Document ---
export interface AccessCodeDoc {
  id: string;
  code: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
}

// --- Banned Device & Security Document ---
export interface BannedDeviceDoc {
  id: string;
  ip?: string;
  fingerprint?: string;
  reason?: string;
  bannedAt: string;
}

// --- Pending Schema & Self-Improvement Proposal Document ---
export interface PendingSchemaChangeDoc {
  id: string;
  description: string;
  suggestedFields: string;
  proposedByAgentId: string;
  status: 'pending' | 'applied' | 'rejected';
  createdAt: string;
}


