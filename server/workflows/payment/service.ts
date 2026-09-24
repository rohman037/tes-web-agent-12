import {
  dbGetQrisConfig,
  dbSaveQrisConfig,
  dbGetTransactions,
  dbSaveTransaction,
  dbGetPackages,
  dbGetClients,
  dbSaveClient,
  dbGetAccessCodes,
  dbSaveAccessCode,
} from '@/src/db/dbService';
import { broadcastLiveEvent } from '@/server/core/state/serverState';

export async function getQrisConfigService() {
  return await dbGetQrisConfig();
}

export async function updateQrisConfigService(config: any) {
  if (!config || typeof config !== 'object') {
    throw new Error('Payload QRIS tidak valid');
  }
  await dbSaveQrisConfig(config);
  broadcastLiveEvent({ type: 'qris_updated', qrisConfig: config });
  return config;
}

export async function getAllTransactionsService() {
  return await dbGetTransactions();
}

export async function createTransactionService(newTrx: any, accessCodeHeader?: string) {
  if (!newTrx || !newTrx.id) {
    throw new Error('Payload transaksi tidak valid');
  }

  const cleanId = (newTrx.id || '').trim().toUpperCase();
  newTrx.id = cleanId;

  // Validate member package requirement on server
  const packages = await dbGetPackages();
  const pkg = packages.find((p: any) => p.id === newTrx.packageId);
  if (pkg && pkg.targetCategory === 'member') {
    const codeToCheck = String(newTrx.accessCode || accessCodeHeader || '').trim().toUpperCase();
    const clients = await dbGetClients();
    const validMember = clients.find(
      (c: any) =>
        c.accessCode &&
        c.accessCode.toUpperCase() === codeToCheck &&
        (c.status === 'active' || c.status === 'expiring_soon')
    );
    if (!validMember && codeToCheck !== (process.env.ADMIN_ACCESS_CODE || '').trim().toUpperCase()) {
      const err: any = new Error('Paket ini khusus untuk member VIP terdaftar. Silakan login terlebih dahulu dengan Kode Akses member Anda.');
      err.status = 403;
      throw err;
    }
  }

  await dbSaveTransaction(newTrx);

  broadcastLiveEvent({
    type: 'transaction_updated',
    event: {
      action: 'CREATED',
      accessCode: newTrx.accessCode,
      transaction: newTrx,
    },
    transaction: newTrx,
  });

  return newTrx;
}

export async function submitPaymentProofService(id?: string, proofImageBase64?: string, transaction?: any) {
  const cleanId = (id || transaction?.id || '').trim().toUpperCase();
  const list = await dbGetTransactions();
  const idx = list.findIndex((t: any) => (t.id || '').toUpperCase() === cleanId);

  let targetTrx: any;
  if (idx >= 0) {
    targetTrx = list[idx];
    targetTrx.proofImageBase64 = proofImageBase64;
    targetTrx.paymentProofBase64 = proofImageBase64;
    targetTrx.status = 'AWAITING_VERIFICATION';
    targetTrx.updatedAt = Date.now();
  } else {
    if (transaction && (transaction.id || transaction.packageId || transaction.planId)) {
      targetTrx = {
        ...transaction,
        id: cleanId || transaction.id,
        proofImageBase64,
        paymentProofBase64: proofImageBase64,
        status: 'AWAITING_VERIFICATION',
        updatedAt: Date.now(),
        createdAt: transaction.createdAt || Date.now(),
        timestamp: transaction.timestamp || Date.now(),
      };
    } else {
      const err: any = new Error('Transaksi tidak ditemukan');
      err.status = 404;
      throw err;
    }
  }

  await dbSaveTransaction(targetTrx);

  broadcastLiveEvent({
    type: 'transaction_updated',
    event: {
      action: 'PROOF_UPLOADED',
      accessCode: targetTrx.accessCode,
      transaction: targetTrx,
    },
    transaction: targetTrx,
  });

  return targetTrx;
}

export async function approveTransactionService(id?: string, accessCode?: string, validUntil?: string, transaction?: any) {
  const cleanId = (id || transaction?.id || '').trim().toUpperCase();
  const list = await dbGetTransactions();
  const idx = list.findIndex((t: any) => (t.id || '').toUpperCase() === cleanId);

  let approvedTrx: any;
  if (idx >= 0) {
    approvedTrx = list[idx];
  } else if (transaction && transaction.id) {
    approvedTrx = { ...transaction, id: cleanId };
  } else {
    const err: any = new Error('Transaksi tidak ditemukan');
    err.status = 404;
    throw err;
  }

  const generatedCode = accessCode || approvedTrx.accessCode;
  approvedTrx.status = 'APPROVED';
  approvedTrx.accessCode = generatedCode;
  approvedTrx.validUntil = validUntil || approvedTrx.validUntil || 'Lifetime (Akses Selamanya)';
  approvedTrx.updatedAt = Date.now();

  await dbSaveTransaction(approvedTrx);

  // 1. Persist & Broadcast access code
  if (generatedCode) {
    const accessCodesList = await dbGetAccessCodes();
    const existingCode = accessCodesList.find((c: any) => c.code.toUpperCase() === generatedCode.toUpperCase());
    if (!existingCode) {
      await dbSaveAccessCode({
        code: generatedCode.toUpperCase(),
        note: `Pembelian Paket ${approvedTrx.packageName || approvedTrx.packageId || 'Satset'} - ${approvedTrx.customerName || 'Klien'}`,
        createdAt: Date.now(),
      });
      const updatedCodes = await dbGetAccessCodes();
      broadcastLiveEvent({ type: 'access_codes_updated', accessCodes: updatedCodes });
    }
  }

  // 2. Upsert & Broadcast ClientItem
  const clientsList = await dbGetClients();
  const existingClientIdx = clientsList.findIndex((c: any) => c.accessCode && c.accessCode.toUpperCase() === (generatedCode || '').toUpperCase());

  let expiryDateIso = '';
  if (validUntil) {
    const parsedDate = new Date(validUntil);
    if (!isNaN(parsedDate.getTime())) {
      expiryDateIso = parsedDate.toISOString();
    }
  }

  if (!expiryDateIso) {
    const now = new Date();
    if (approvedTrx.packageId === 'mingguan') {
      now.setDate(now.getDate() + 7);
    } else if (approvedTrx.packageId === 'bulanan') {
      now.setDate(now.getDate() + 30);
    } else {
      now.setFullYear(now.getFullYear() + 100);
    }
    expiryDateIso = now.toISOString();
  }

  const newOrUpdatedClient = {
    id: existingClientIdx >= 0 ? clientsList[existingClientIdx].id : `cli_${Date.now()}`,
    accessCode: generatedCode,
    name: approvedTrx.customerName || 'Klien Satset',
    whatsapp: approvedTrx.whatsapp || '',
    email: approvedTrx.email || '',
    packageId: approvedTrx.packageId || 'vip',
    packageName: approvedTrx.packageName || 'Akses VIP Satset',
    price: approvedTrx.amount || approvedTrx.price || 0,
    startDate: new Date().toISOString(),
    expiryDate: expiryDateIso,
    status: 'active' as any,
    type: 'standard' as any,
    createdAt: new Date().toISOString(),
    toolUsage: existingClientIdx >= 0 && clientsList[existingClientIdx].toolUsage ? clientsList[existingClientIdx].toolUsage : {
      tiktokDownloader: 0,
      contentIdeas: 0,
      videoToPrompt: 0,
      photoPrompt: 0,
      frameExtractor: 0,
    },
  };

  await dbSaveClient(newOrUpdatedClient);
  const updatedClients = await dbGetClients();

  broadcastLiveEvent({
    type: 'clients_updated',
    clients: updatedClients,
  });

  broadcastLiveEvent({
    type: 'transaction_updated',
    event: {
      action: 'APPROVED',
      accessCode: generatedCode,
      validUntil,
      transaction: approvedTrx,
    },
    transaction: approvedTrx,
  });

  return { transaction: approvedTrx, client: newOrUpdatedClient };
}

export async function rejectTransactionService(id: string, rejectReason?: string, transaction?: any) {
  const list = await dbGetTransactions();
  const idx = list.findIndex((t: any) => t.id === id);
  let target: any;

  if (idx === -1) {
    if (transaction && transaction.id) {
      target = transaction;
    } else {
      const err: any = new Error('Transaksi tidak ditemukan');
      err.status = 404;
      throw err;
    }
  } else {
    target = list[idx];
  }

  target.status = 'REJECTED';
  target.rejectReason = rejectReason || 'Ditolak oleh admin.';
  target.updatedAt = Date.now();
  await dbSaveTransaction(target);

  broadcastLiveEvent({
    type: 'transaction_updated',
    event: {
      action: 'REJECTED',
      accessCode: target.accessCode,
      rejectReason: target.rejectReason,
      transaction: target,
    },
    transaction: target,
  });

  return target;
}
