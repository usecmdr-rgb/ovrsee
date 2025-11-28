"use client";

import Modal from "@/components/ui/Modal";
import { useAppState } from "@/context/AppStateContext";
import { useTranslation } from "@/hooks/useTranslation";

const TermsModal = () => {
  const { showTermsModal, setShowTermsModal } = useAppState();
  const t = useTranslation();

  const statements = [
    t("termsStatement1"),
    t("termsStatement2"),
    t("termsStatement3"),
    t("termsStatement4"),
    t("termsStatement5"),
    t("termsStatement6"),
    t("termsStatement7"),
    t("termsStatement8"),
    t("termsStatement9"),
    t("termsStatement10"),
    t("termsStatement11"),
    t("termsStatement12"),
  ];

  return (
    <Modal
      title={t("termsModalTitle")}
      description={t("termsModalDescription")}
      open={showTermsModal}
      onClose={() => setShowTermsModal(false)}
      size="lg"
    >
      <ol className="space-y-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        {statements.map((text, index) => (
          <li key={`terms-${index}`} className="flex items-start gap-2">
            <span className="font-semibold">{index + 1}.</span>
            <span>{text}</span>
          </li>
        ))}
      </ol>
    </Modal>
  );
};

export default TermsModal;
