import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  Search, 
  X, 
  Check, 
  AlertTriangle, 
  Copy, 
  Sparkles,
  RefreshCw,
  Radio,
  ShieldCheck,
  TrendingUp,
  DollarSign,
  UserCheck
} from 'lucide-react';
import DataTable from '../../components/admin/DataTable';
import { 
  getAllTransactions, 
  approveTransaction, 
  rejectTransaction, 
  Transaction, 
  formatRupiah,
  listenTransactionsUpdated,
  syncTransactionsFromServer
} from '../../lib/payment';
import { sseManager } from '../../lib/sseManager';
import { maskAccessCode } from '../../utils/maskAccessCode';

export default function PaymentVerificationPanel() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedProofModalTrx, setSelectedProofModalTrx] = useState<Transaction | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [tabFilter, setTabFilter] = useState<'queue' | 'all'>('queue');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isLiveConnected, setIsLiveConnected] = useState(true);
  const [processingTrxId, setProcessingTrxId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    refreshData();
    const unsubscribeTrx = listenTransactionsUpdated(refreshData);
    window.addEventListener('storage', refreshData);
    window.addEventListener('transactions-updated', refreshData);

    // Direct SSE Manager real-time subscription for sub-second updates
    const unsubscribeSSE = sseManager.subscribe((data) => {
      if (data && (data.type === 'transaction_updated' || data.type === 'clients_updated' || data.type === 'access_codes_updated')) {
        refreshData();
      }
    });

    // Polling cadangan jika SSE terputus (10 detik)
    const interval = setInterval(refreshData, 10000);
    return () => {
      unsubscribeTrx();
      unsubscribeSSE();
      window.removeEventListener('storage', refreshData);
      window.removeEventListener('transactions-updated', refreshData);
      clearInterval(interval);
    };
  }, []);

  const refreshData = async () => {
    setTransactions(getAllTransactions());
    syncTransactionsFromServer().then((data) => {
      if (Array.isArray(data)) {
        setTransactions(data);
      }
    }).catch(() => {});
  };

  const safeTransactions = Array.isArray(transactions) ? transactions : [];

  const handleApproveTrx = async (trxId: string) => {
    if (processingTrxId) return;
    setProcessingTrxId(trxId);
    try {
      const updated = await approveTransaction(trxId);
      if (updated) {
        setSelectedProofModalTrx(null);
        await refreshData();
        setToastMessage({
          type: 'success',
          text: `✅ Transaksi ${trxId} Berhasil Disetujui! Kode Akses baru: ${updated.accessCode || 'Aktif'}`
        });
      } else {
        setToastMessage({
          type: 'error',
          text: `Gagal menyetujui transaksi ${trxId}. Transaksi tidak ditemukan.`
        });
      }
    } catch (err: any) {
      setToastMessage({
        type: 'error',
        text: `Gagal menyetujui transaksi: ${err?.message || 'Terjadi kesalahan sistem'}`
      });
    } finally {
      setProcessingTrxId(null);
    }
  };

  const handleRejectTrx = async (trxId: string) => {
    if (!rejectReasonInput.trim()) {
      setToastMessage({ type: 'error', text: 'Mohon masukkan alasan penolakan.' });
      return;
    }
    if (processingTrxId) return;
    setProcessingTrxId(trxId);
    try {
      const updated = await rejectTransaction(trxId, rejectReasonInput.trim());
      if (updated) {
        setSelectedProofModalTrx(null);
        setShowRejectForm(false);
        setRejectReasonInput('');
        await refreshData();
        setToastMessage({
          type: 'success',
          text: `❌ Transaksi ${trxId} telah ditolak.`
        });
      } else {
        setToastMessage({
          type: 'error',
          text: `Gagal menolak transaksi ${trxId}.`
        });
      }
    } catch (err: any) {
      setToastMessage({
        type: 'error',
        text: `Gagal menolak transaksi: ${err?.message || 'Terjadi kesalahan sistem'}`
      });
    } finally {
      setProcessingTrxId(null);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const pendingQueue = safeTransactions.filter((t) => t.status === 'AWAITING_VERIFICATION');
  const approvedList = safeTransactions.filter((t) => t.status === 'APPROVED');
  const rejectedList = safeTransactions.filter((t) => t.status === 'REJECTED');
  const totalOmsetApproved = approvedList.reduce((acc, curr) => acc + (curr.amount || curr.totalPrice || 0), 0);

  const displayedTransactions = (tabFilter === 'queue' ? pendingQueue : safeTransactions).filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (t.id || '').toLowerCase().includes(q) ||
      (t.customerName || '').toLowerCase().includes(q) ||
      (t.whatsapp || '').toLowerCase().includes(q) ||
      (t.email || '').toLowerCase().includes(q) ||
      (t.packageName || '').toLowerCase().includes(q) ||
      (t.accessCode || '').toLowerCase().includes(q)
    );
  });

  const columns = [
    {
      header: 'ID & Pembeli',
      render: (t: Transaction) => (
        <div className="space-y-0.5">
          <div className="font-mono text-xs font-bold text-[#3525cd] flex items-center gap-1.5">
            <span>{t.id}</span>
            {t.status === 'AWAITING_VERIFICATION' && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            )}
          </div>
          <div className="font-extrabold text-slate-900 text-xs">{t.customerName}</div>
          <div className="text-[11px] text-slate-500 flex items-center gap-2">
            <span>WA: {t.whatsapp}</span>
            {t.email && <span className="text-slate-400">• {t.email}</span>}
          </div>
        </div>
      )
    },
    {
      header: 'Paket & Nominal',
      render: (t: Transaction) => (
        <div className="space-y-0.5">
          <div className="font-bold text-slate-800 text-xs">{t.packageName || t.planName}</div>
          <div className="font-black text-emerald-600 text-xs">{formatRupiah(t.amount || t.totalPrice || 0)}</div>
        </div>
      )
    },
    {
      header: 'Status & Waktu',
      render: (t: Transaction) => (
        <div className="space-y-1">
          {t.status === 'AWAITING_VERIFICATION' && (
            <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 w-fit shadow-2xs">
              <Clock className="w-3 h-3 text-amber-500 animate-spin" />
              <span>Menunggu Verifikasi</span>
            </span>
          )}
          {t.status === 'APPROVED' && (
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 w-fit shadow-2xs">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Disetujui (Approved)</span>
            </span>
          )}
          {t.status === 'REJECTED' && (
            <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 w-fit shadow-2xs">
              <XCircle className="w-3 h-3 text-rose-600" />
              <span>Ditolak (Rejected)</span>
            </span>
          )}
          {t.status === 'PENDING_PROOF' && (
            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 w-fit">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>Menunggu Bukti Transfer</span>
            </span>
          )}

          <div className="text-[10px] text-slate-400 font-medium">
            {t.timestamp ? new Date(t.timestamp).toLocaleString('id-ID') : '-'}
          </div>
        </div>
      )
    },
    {
      header: 'Kode Akses Diterbitkan',
      render: (t: Transaction) => (
        t.accessCode ? (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <code className="font-mono text-xs font-black text-[#3525cd] bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                {maskAccessCode(t.accessCode)}
              </code>
              <button
                type="button"
                onClick={() => handleCopyCode(t.accessCode!)}
                className="p-1 rounded hover:bg-slate-100 text-slate-500 cursor-pointer"
                title="Salin Kode Akses"
              >
                {copiedCode === t.accessCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            {t.validUntil && (
              <div className="text-[10px] text-slate-500">
                Masa Aktif: <strong className="text-slate-700">{t.validUntil}</strong>
              </div>
            )}
          </div>
        ) : (
          <span className="text-slate-400 italic text-[11px]">- Belum Ada -</span>
        )
      )
    },
    {
      header: 'Aksi Verifikasi',
      render: (t: Transaction) => (
        <div className="flex items-center gap-2">
          {t.paymentProofBase64 && (
            <button
              type="button"
              onClick={() => {
                setSelectedProofModalTrx(t);
                setShowRejectForm(false);
              }}
              className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-[#3525cd] font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer border border-indigo-100 shadow-2xs"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Lihat Bukti</span>
            </button>
          )}

          {t.status === 'AWAITING_VERIFICATION' && (
            <button
              type="button"
              disabled={processingTrxId === t.id}
              onClick={() => handleApproveTrx(t.id)}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-black text-xs transition-colors shadow-xs cursor-pointer flex items-center gap-1"
            >
              {processingTrxId === t.id ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              <span>{processingTrxId === t.id ? 'Memproses...' : 'Setujui'}</span>
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className={`p-4 rounded-2xl flex items-center justify-between shadow-sm border text-xs font-bold transition-all animate-in fade-in slide-in-from-top-2 duration-150 ${
          toastMessage.type === 'success' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-rose-50 text-rose-900 border-rose-200'
        }`}>
          <div className="flex items-center gap-2">
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="p-1 rounded hover:bg-black/5 text-slate-500 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Real-time Status Metric Summary Header */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Antrean Verifikasi</p>
            <h3 className="text-2xl font-black text-amber-600 mt-1">{pendingQueue.length} Transaksi</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Membutuhkan persetujuan admin</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Pembayaran Disetujui</p>
            <h3 className="text-2xl font-black text-emerald-600 mt-1">{approvedList.length} Selesai</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Kode akses aktif diterbitkan</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total Omset QRIS</p>
            <h3 className="text-xl font-black text-slate-900 mt-1">{formatRupiah(totalOmsetApproved)}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Dari {approvedList.length} lisensi terverifikasi</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 text-[#3525cd] flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Status SSE Sync</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="text-sm font-black text-slate-900">Realtime Aktif</h3>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Live update tanpa reload</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-200 text-emerald-600 flex items-center justify-center">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
        </div>
      </div>

      <DataTable
        title="Verifikasi Antrean Pembayaran QRIS Pembeli"
        subtitle="Periksa bukti transfer QRIS manual yang diunggah oleh pembeli dan terbitkan Kode Akses otomatis."
        columns={columns}
        data={displayedTransactions}
        emptyMessage={tabFilter === 'queue' ? 'Tidak ada antrean pembayaran pending saat ini.' : 'Belum ada transaksi.'}
        filterComponent={
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex rounded-xl bg-slate-200/80 p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setTabFilter('queue')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  tabFilter === 'queue' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Antrean Pending</span>
                {pendingQueue.length > 0 && (
                  <span className="px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[10px] font-black animate-pulse">
                    {pendingQueue.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setTabFilter('all')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  tabFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua Transaksi ({safeTransactions.length})
              </button>
            </div>

            <div className="relative min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama, WA, kode, ID..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#3525cd]"
              />
            </div>

            <button
              type="button"
              onClick={refreshData}
              className="p-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-[#3525cd] transition-colors cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        }
      />

      {/* PROOF CHECK MODAL */}
      {selectedProofModalTrx && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-slate-100 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Bukti Pembayaran QRIS — {selectedProofModalTrx.id}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedProofModalTrx.customerName} ({selectedProofModalTrx.whatsapp})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProofModalTrx(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1">
                <div>Paket Dipesan: <span className="font-bold text-slate-900">{selectedProofModalTrx.packageName || selectedProofModalTrx.planName}</span></div>
                <div>Total Tagihan: <span className="font-black text-emerald-600">{formatRupiah(selectedProofModalTrx.amount || selectedProofModalTrx.totalPrice || 0)}</span></div>
                <div>Email Pembeli: <span className="font-mono text-slate-700">{selectedProofModalTrx.email || '-'}</span></div>
                <div>Catatan Pembeli: {selectedProofModalTrx.note || '-'}</div>
              </div>

              {selectedProofModalTrx.paymentProofBase64 ? (
                <div className="border border-slate-200 rounded-xl p-2 bg-slate-950 text-center">
                  <img
                    src={selectedProofModalTrx.paymentProofBase64}
                    alt="Bukti Transfer QRIS"
                    className="max-h-[320px] mx-auto object-contain rounded-lg"
                  />
                </div>
              ) : (
                <div className="p-8 bg-slate-50 rounded-xl text-center text-xs text-slate-400">
                  Tidak ada foto bukti transfer terlampir.
                </div>
              )}

              {showRejectForm ? (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                  <label className="text-xs font-bold text-rose-900 block">Alasan Penolakan Transaksi:</label>
                  <textarea
                    rows={2}
                    value={rejectReasonInput}
                    onChange={(e) => setRejectReasonInput(e.target.value)}
                    placeholder="misal: Nominal tidak sesuai / foto struk tidak jelas..."
                    className="w-full p-2 bg-white rounded-lg border border-rose-300 text-xs focus:outline-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      disabled={!!processingTrxId}
                      onClick={() => setShowRejectForm(false)}
                      className="px-3 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-xs font-bold"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      disabled={!!processingTrxId}
                      onClick={() => handleRejectTrx(selectedProofModalTrx.id)}
                      className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white text-xs font-bold flex items-center gap-1"
                    >
                      {processingTrxId === selectedProofModalTrx.id && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      <span>{processingTrxId === selectedProofModalTrx.id ? 'Memproses...' : 'Tolak'}</span>
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            {selectedProofModalTrx.status === 'AWAITING_VERIFICATION' && !showRejectForm && (
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={!!processingTrxId}
                  onClick={() => setShowRejectForm(true)}
                  className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  Tolak Transaksi
                </button>
                <button
                  type="button"
                  disabled={!!processingTrxId}
                  onClick={() => handleApproveTrx(selectedProofModalTrx.id)}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {processingTrxId === selectedProofModalTrx.id ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>{processingTrxId === selectedProofModalTrx.id ? 'Memproses...' : 'Setujui & Terbitkan Akses'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
