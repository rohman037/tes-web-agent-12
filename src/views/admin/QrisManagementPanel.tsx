import React, { useState, useEffect, useRef } from 'react';
import {
  QrCode,
  Upload,
  Check,
  RefreshCw,
  Sparkles,
  Trash2,
  ZoomIn,
  X,
  Download,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Building2,
  ShieldCheck,
  ImageIcon
} from 'lucide-react';
import { getQrisConfig, updateQrisConfig, DEFAULT_QRIS_SVG, QrisConfig } from '../../lib/payment';

export default function QrisManagementPanel() {
  const [qrisConfig, setQrisConfig] = useState<QrisConfig>(() => getQrisConfig());
  const [newQrisFile, setNewQrisFile] = useState<File | null>(null);
  const [newQrisBase64, setNewQrisBase64] = useState<string | null>(null);
  const [merchantNameInput, setMerchantNameInput] = useState(qrisConfig.merchantName || 'Tools Satset Official');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [showZoomModal, setShowZoomModal] = useState<boolean>(false);

  // Toast Notification State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  useEffect(() => {
    loadQrisData();
    window.addEventListener('satset_qris_updated', loadQrisData);
    window.addEventListener('storage', loadQrisData);
    return () => {
      window.removeEventListener('satset_qris_updated', loadQrisData);
      window.removeEventListener('storage', loadQrisData);
    };
  }, []);

  const loadQrisData = async () => {
    const cfg = getQrisConfig();
    setQrisConfig(cfg);
    setMerchantNameInput(cfg.merchantName || 'Tools Satset Official');
    try {
      const res = await fetch('/api/qris');
      if (res.ok) {
        const data = await res.json();
        const serverConfig = data?.qrisConfig || data;
        if (serverConfig && typeof serverConfig === 'object' && serverConfig.imageBase64) {
          setQrisConfig(serverConfig);
          setMerchantNameInput(serverConfig.merchantName || 'Tools Satset Official');
          localStorage.setItem('satset_qris_config', JSON.stringify(serverConfig));
        }
      }
    } catch (e) {
      // Local config loaded safely
    }
  };

  const validateAndProcessFile = (file: File) => {
    // 1. Validate MIME type
    if (!file.type.startsWith('image/')) {
      showToast('File yang diunggah harus berupa gambar (PNG, JPG, JPEG, WEBP).', 'error');
      return;
    }

    // 2. Validate file size (max 5MB)
    const maxSizeBytes = 5 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
      showToast(`Ukuran file maksimal 5MB. File yang Anda pilih berukuran ${sizeMb}MB.`, 'error');
      return;
    }

    setNewQrisFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setNewQrisBase64(reader.result);
        showToast(`Gambar "${file.name}" siap disimpan.`, 'info');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleQrisFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndProcessFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndProcessFile(file);
    }
  };

  const handleSaveQris = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetImage = newQrisBase64 || qrisConfig.imageBase64;
    if (!targetImage) {
      showToast('Mohon pilih foto QRIS terlebih dahulu.', 'error');
      return;
    }

    const trimmedMerchant = merchantNameInput.trim() || 'Tools Satset Official';

    setIsSaving(true);
    try {
      const res = await updateQrisConfig(targetImage, trimmedMerchant);
      if (res.success) {
        setQrisConfig({
          imageBase64: targetImage,
          merchantName: trimmedMerchant,
        });
        setNewQrisFile(null);
        setNewQrisBase64(null);
        showToast('Foto & Nama Merchant QRIS Resmi Berhasil Disimpan ke Server!', 'success');
      } else {
        showToast(res.error || 'Gagal menyimpan ke server. Data disimpan di cache lokal.', 'info');
      }
    } catch (err: any) {
      showToast('Terjadi kesalahan saat menyimpan QRIS: ' + (err?.message || ''), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefault = async () => {
    setIsSaving(true);
    try {
      const defaultMerchant = 'Tools Satset Official (QRIS ALL PAYMENT)';
      await updateQrisConfig(DEFAULT_QRIS_SVG, defaultMerchant);
      setQrisConfig({
        imageBase64: DEFAULT_QRIS_SVG,
        merchantName: defaultMerchant,
      });
      setMerchantNameInput(defaultMerchant);
      setNewQrisFile(null);
      setNewQrisBase64(null);
      setShowResetModal(false);
      showToast('Barcode QRIS berhasil dikembalikan ke barcode default sistem!', 'info');
    } catch (err: any) {
      showToast('Gagal mereset QRIS: ' + (err?.message || ''), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadQris = () => {
    const currentImg = newQrisBase64 || qrisConfig.imageBase64;
    if (!currentImg) return;
    const link = document.createElement('a');
    link.href = currentImg;
    link.download = `qris-satset-${Date.now()}.${currentImg.startsWith('data:image/svg') ? 'svg' : 'png'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Gambar QRIS sedang diunduh.', 'info');
  };

  const currentDisplayImage = newQrisBase64 || qrisConfig.imageBase64;
  const isDefaultImage = qrisConfig.imageBase64 === DEFAULT_QRIS_SVG && !newQrisBase64;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-2xs space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="space-y-1">
          <h3 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 text-[#5b50e5] flex items-center justify-center">
              <QrCode className="w-4 h-4" />
            </div>
            <span>Pengaturan QRIS Pembayaran Resmi</span>
          </h3>
          <p className="text-xs text-slate-500 max-w-xl">
            Unggah foto barcode QRIS All Payment (Gopay, OVO, Dana, ShopeePay, BCA, Mandiri, dll.) agar otomatis tampil di Checkout pembeli.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold flex items-center gap-1.5 shadow-2xs">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Tersinkronisasi Otomatis</span>
          </span>
        </div>
      </div>

      <form onSubmit={handleSaveQris} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form Controls (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Merchant Name Field */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Nama Merchant / Toko QRIS</span>
            </label>
            <input
              type="text"
              value={merchantNameInput}
              onChange={(e) => setMerchantNameInput(e.target.value)}
              placeholder="misal: Tools Satset Official (QRIS ALL PAYMENT)"
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#5b50e5] focus:ring-2 focus:ring-[#5b50e5]/20 transition-all"
              required
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Nama ini akan dicocokkan pembeli di aplikasi mobile banking / e-wallet mereka sebelum transfer.
            </p>
          </div>

          {/* Drag & Drop Upload Box */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                <span>File Barcode QRIS (PNG / JPG / WEBP)</span>
              </label>
              {newQrisFile && (
                <button
                  type="button"
                  onClick={() => {
                    setNewQrisFile(null);
                    setNewQrisBase64(null);
                    showToast('Pemilihan file dibatalkan.', 'info');
                  }}
                  className="text-[11px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Batal Unggah</span>
                </button>
              )}
            </div>

            <label
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-7 text-center block cursor-pointer transition-all ${
                isDragging
                  ? 'border-[#5b50e5] bg-indigo-50/60 scale-[1.01]'
                  : newQrisFile
                  ? 'border-emerald-300 bg-emerald-50/30'
                  : 'border-slate-200 hover:border-[#5b50e5] bg-slate-50/60 hover:bg-indigo-50/30'
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-[#5b50e5] flex items-center justify-center mx-auto mb-3 shadow-2xs">
                {isDragging ? (
                  <Upload className="w-6 h-6 animate-bounce text-[#5b50e5]" />
                ) : newQrisFile ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                ) : (
                  <Upload className="w-6 h-6 text-[#5b50e5]" />
                )}
              </div>

              {newQrisFile ? (
                <div className="space-y-1">
                  <span className="text-xs font-extrabold text-emerald-800 block">
                    {newQrisFile.name}
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-600 block">
                    {(newQrisFile.size / 1024).toFixed(1)} KB • Siap disimpan
                  </span>
                </div>
              ) : (
                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-800 block">
                    Klik untuk memilih atau tarik file foto barcode ke sini
                  </span>
                  <span className="text-[11px] text-slate-400 block">
                    Mendukung PNG, JPG, JPEG, atau WEBP (Maksimal 5MB)
                  </span>
                </div>
              )}

              <input
                type="file"
                accept="image/png, image/jpeg, image/jpg, image/webp"
                onChange={handleQrisFileChange}
                className="hidden"
              />
            </label>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl bg-[#5b50e5] hover:bg-[#4f46e5] text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan ke Server...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Simpan QRIS Resmi</span>
                </>
              )}
            </button>

            {!isDefaultImage && (
              <button
                type="button"
                onClick={() => setShowResetModal(true)}
                disabled={isSaving}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                <span>Reset ke Default</span>
              </button>
            )}

            {currentDisplayImage && (
              <button
                type="button"
                onClick={handleDownloadQris}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Unduh Gambar</span>
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Interactive Live Preview (5 cols) */}
        <div className="lg:col-span-5 bg-slate-50 border border-slate-200/80 rounded-2xl p-6 flex flex-col items-center space-y-4">
          <div className="w-full flex items-center justify-between border-b border-slate-200/60 pb-3">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <QrCode className="w-4 h-4 text-[#5b50e5]" />
              <span>Live Checkout Preview</span>
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-[#5b50e5] border border-indigo-100">
              Tampilan Pembeli
            </span>
          </div>

          {currentDisplayImage ? (
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm max-w-[260px] w-full text-center space-y-3 group relative transition-all">
              {/* Image Container with Zoom Trigger */}
              <div
                onClick={() => setShowZoomModal(true)}
                className="relative cursor-pointer overflow-hidden rounded-xl border border-slate-100 bg-white p-1.5"
                title="Klik untuk memperbesar"
              >
                <img
                  src={currentDisplayImage}
                  alt="QRIS Live Preview"
                  className="w-full h-auto object-contain max-h-[220px] mx-auto rounded-lg"
                />
                <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                  <span className="px-2.5 py-1 rounded-lg bg-white/90 text-slate-800 text-[10px] font-extrabold flex items-center gap-1 shadow-xs">
                    <ZoomIn className="w-3.5 h-3.5 text-[#5b50e5]" />
                    <span>Perbesar</span>
                  </span>
                </div>
              </div>

              {/* Merchant Title in Preview */}
              <div className="border-t border-slate-100 pt-2.5 space-y-1">
                <div className="text-[11px] font-black text-slate-900 leading-tight">
                  {merchantNameInput || 'Tools Satset Official'}
                </div>
                <p className="text-[10px] font-medium text-slate-400">
                  NMID: ID1020038492019 (QRIS Standar Bank Indonesia)
                </p>
              </div>

              {/* Supported Payment Logos Tag */}
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 text-[9px] font-bold text-slate-500 uppercase tracking-tight leading-relaxed">
                Gopay • OVO • DANA • ShopeePay • BCA • Mandiri • BRI • BNI
              </div>
            </div>
          ) : (
            <div className="w-48 h-48 rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 text-xs font-medium text-center p-4 space-y-2">
              <QrCode className="w-8 h-8 text-slate-300" />
              <span>Belum ada barcode QRIS diunggah</span>
            </div>
          )}

          <p className="text-[11px] text-slate-400 text-center max-w-xs leading-relaxed">
            Perubahan gambar dan nama toko akan langsung otomatis di-push ke wizard pembayaran user secara real-time.
          </p>
        </div>
      </form>

      {/* CONFIRMATION MODAL: RESET TO DEFAULT */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-7 shadow-2xl space-y-5 border border-slate-100 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                    Reset Barcode QRIS?
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Kembalikan ke barcode resmi bawaan sistem
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              Barcode QRIS kustom Anda saat ini akan digantikan dengan barcode standar Tools Satset Official. Aksi ini akan langsung ter-update di tampilan checkout.
            </p>

            <div className="border-t border-slate-100 pt-3 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer px-3 py-2"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleResetToDefault}
                disabled={isSaving}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5 transition-all disabled:opacity-60"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                <span>Ya, Reset ke Default</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ZOOM MODAL: FULL VIEW QRIS */}
      {showZoomModal && currentDisplayImage && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 border border-slate-100 animate-in zoom-in-95 duration-150 text-center">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-bold text-slate-900">
                {merchantNameInput || 'QRIS Tools Satset'}
              </span>
              <button
                type="button"
                onClick={() => setShowZoomModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-white p-2 rounded-2xl border border-slate-200">
              <img
                src={currentDisplayImage}
                alt="QRIS Full View"
                className="w-full h-auto object-contain max-h-[380px] mx-auto rounded-xl"
              />
            </div>

            <div className="pt-2 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleDownloadQris}
                className="px-4 py-2 rounded-xl bg-[#5b50e5] hover:bg-[#4f46e5] text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh Barcode</span>
              </button>
              <button
                type="button"
                onClick={() => setShowZoomModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING TOAST NOTIFICATION */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[9999] max-w-md p-4 rounded-2xl shadow-2xl border flex items-start gap-3 animate-in slide-in-from-bottom-5 duration-200 ${
            toast.type === 'success'
              ? 'bg-slate-950 text-emerald-300 border-emerald-500/40'
              : toast.type === 'error'
              ? 'bg-slate-950 text-rose-300 border-rose-500/40'
              : 'bg-slate-950 text-indigo-300 border-indigo-500/40'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : toast.type === 'error' ? (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          ) : (
            <Sparkles className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 text-xs leading-relaxed font-semibold text-white">
            {toast.message}
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
