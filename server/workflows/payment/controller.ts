import { Request, Response } from 'express';
import { handleApiError } from '@/server/core/utils/errorHandler';
import { logPaymentEvent } from '@/server/core/security/auditLogService';
import {
  getQrisConfigService,
  updateQrisConfigService,
  getAllTransactionsService,
  createTransactionService,
  submitPaymentProofService,
  approveTransactionService,
  rejectTransactionService,
} from './service';

export async function getQrisConfigController(req: Request, res: Response) {
  try {
    const config = await getQrisConfigService();
    return res.json(config);
  } catch (err) {
    return handleApiError(res, err);
  }
}

export async function updateQrisConfigController(req: Request, res: Response) {
  try {
    const config = await updateQrisConfigService(req.body);
    return res.json({ success: true, qrisConfig: config });
  } catch (err) {
    return handleApiError(res, err);
  }
}

export async function getTransactionsController(req: Request, res: Response) {
  try {
    const { id } = req.query;
    const user = (req as any).user;
    const isAdmin = user && (user.role === 'admin' || user.role === 'owner');

    // Specific invoice lookup (e.g. user checking payment status for their invoice ID)
    if (id) {
      const cleanId = String(id).trim().toUpperCase();
      const transactions = await getAllTransactionsService();
      const found = transactions.find((t: any) => (t.id || '').toUpperCase() === cleanId);
      if (!found) {
        return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
      }
      return res.json(found);
    }

    // Admins and owners can access complete transaction ledger
    if (isAdmin) {
      const transactions = await getAllTransactionsService();
      return res.json(transactions);
    }

    // Authenticated regular users only see transactions matching their email
    if (user?.email) {
      const transactions = await getAllTransactionsService();
      const userTrx = transactions.filter(
        (t: any) =>
          (t.email && t.email.toLowerCase() === user.email.toLowerCase()) ||
          (t.customerEmail && t.customerEmail.toLowerCase() === user.email.toLowerCase())
      );
      return res.json(userTrx);
    }

    // Unauthenticated callers cannot scrape customer databases
    return res.status(401).json({
      error: 'Otorisasi diperlukan untuk mengakses daftar riwayat transaksi.',
      code: 'AUTH_REQUIRED',
    });
  } catch (err) {
    return handleApiError(res, err);
  }
}

export async function createTransactionController(req: Request, res: Response) {
  try {
    const accessCodeHeader = req.headers['x-access-code'] as string;
    const transaction = await createTransactionService(req.body, accessCodeHeader);
    await logPaymentEvent(
      'TRANSACTION_CREATED',
      req,
      `Pesanan baru dibuat untuk paket: ${transaction.packageName || transaction.packageId || 'Satset'} senilai Rp ${transaction.price || 0}`,
      transaction.customerName || transaction.customerEmail
    );
    return res.json({ success: true, transaction });
  } catch (err) {
    return handleApiError(res, err);
  }
}

export async function submitProofController(req: Request, res: Response) {
  try {
    const { id, proofImageBase64, transaction } = req.body;
    const updatedTrx = await submitPaymentProofService(id, proofImageBase64, transaction);
    await logPaymentEvent(
      'PROOF_SUBMITTED',
      req,
      `Bukti transfer pembayaran diunggah untuk Invoice ${id}`,
      updatedTrx.customerName || updatedTrx.customerEmail
    );
    return res.json({ success: true, transaction: updatedTrx });
  } catch (err) {
    return handleApiError(res, err);
  }
}

export async function approveTransactionController(req: Request, res: Response) {
  try {
    const { id, accessCode, validUntil, transaction } = req.body;
    const result = await approveTransactionService(id, accessCode, validUntil, transaction);
    const adminUser = (req as any).user;
    await logPaymentEvent(
      'TRANSACTION_APPROVED',
      req,
      `Transaksi ${id} DISETUJUI oleh Admin (${adminUser?.name || 'Administrator'}). Kode akses: ${result.transaction?.accessCode}`,
      adminUser?.name || 'Admin'
    );
    return res.json({ success: true, ...result });
  } catch (err) {
    return handleApiError(res, err);
  }
}

export async function rejectTransactionController(req: Request, res: Response) {
  try {
    const { id, rejectReason, transaction } = req.body;
    const updatedTrx = await rejectTransactionService(id, rejectReason, transaction);
    const adminUser = (req as any).user;
    await logPaymentEvent(
      'TRANSACTION_REJECTED',
      req,
      `Transaksi ${id} DITOLAK oleh Admin (${adminUser?.name || 'Administrator'}). Alasan: ${rejectReason || 'Tidak valid'}`,
      adminUser?.name || 'Admin'
    );
    return res.json({ success: true, transaction: updatedTrx });
  } catch (err) {
    return handleApiError(res, err);
  }
}

