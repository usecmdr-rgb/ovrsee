"use client";

import Modal from "@/components/ui/Modal";
import { useTranslation } from "@/hooks/useTranslation";

interface CallForwardingModalProps {
  open: boolean;
  onClose: () => void;
  alohaPhoneNumber: string;
  onConfirmSetup: () => Promise<void>;
}

export default function CallForwardingModal({
  open,
  onClose,
  alohaPhoneNumber,
  onConfirmSetup,
}: CallForwardingModalProps) {
  const t = useTranslation();
  const handleConfirm = async () => {
    try {
      await onConfirmSetup();
      onClose();
    } catch (error) {
      console.error("Error confirming forwarding:", error);
    }
  };

  return (
    <Modal
      title={t("callForwardingTitle")}
      description={t("callForwardingDescription")}
      open={open}
      onClose={onClose}
      size="lg"
    >
      <div className="space-y-6">
        <div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            {t("callForwardingInstructions")}
          </p>
          <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <p className="font-mono font-semibold text-lg text-slate-900 dark:text-slate-100">
              {alohaPhoneNumber}
            </p>
          </div>
        </div>

        <div>
          <h3 className="font-semibold mb-3">{t("callForwardingInstructionsByPhone")}</h3>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-sm mb-2">{t("callForwardingIPhoneTitle")}</h4>
              <ol className="text-sm text-slate-600 dark:text-slate-400 space-y-1 list-decimal list-inside">
                <li>{t("callForwardingIPhone1")}</li>
                <li>{t("callForwardingIPhone2")}</li>
                <li>{t("callForwardingIPhone3")}</li>
                <li>{t("callForwardingIPhone4").replace("{number}", alohaPhoneNumber)}</li>
                <li>{t("callForwardingIPhone5")}</li>
              </ol>
            </div>

            <div>
              <h4 className="font-medium text-sm mb-2">{t("callForwardingAndroidTitle")}</h4>
              <ol className="text-sm text-slate-600 dark:text-slate-400 space-y-1 list-decimal list-inside">
                <li>{t("callForwardingAndroid1")}</li>
                <li>{t("callForwardingAndroid2")}</li>
                <li>{t("callForwardingAndroid3")}</li>
                <li>{t("callForwardingAndroid4").replace("{number}", alohaPhoneNumber)}</li>
                <li>{t("callForwardingAndroid5")}</li>
              </ol>
            </div>

            <div>
              <h4 className="font-medium text-sm mb-2">{t("callForwardingOtherPhonesTitle")}</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {t("callForwardingOtherPhones")}
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>{t("callForwardingNote")}:</strong> {t("callForwardingNoteText").replace("{number}", alohaPhoneNumber)}
          </p>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            {t("close")}
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 bg-brand-accent text-white rounded-lg hover:bg-brand-accent/90 transition-colors"
          >
            {t("callForwardingConfirmButton")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
