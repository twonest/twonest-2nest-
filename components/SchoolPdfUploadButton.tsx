"use client";

type SchoolPdfUploadButtonProps = {
  disabled?: boolean;
  onFileSelected: (file: File) => void | Promise<void>;
};

export default function SchoolPdfUploadButton({ disabled = false, onFileSelected }: SchoolPdfUploadButtonProps) {
  return (
    <label
      className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(74,144,217,0.35)] transition ${
        disabled ? "cursor-not-allowed bg-[#9EBFE0]" : "cursor-pointer bg-[#4A90D9] hover:brightness-105"
      }`}
    >
      📎 Déposer le calendrier scolaire (PDF)
      <input
        type="file"
        accept="application/pdf"
        disabled={disabled}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) {
            return;
          }
          void onFileSelected(file);
        }}
      />
    </label>
  );
}
