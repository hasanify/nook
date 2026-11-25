import {
  ArrowClockwiseIcon,
  CheckCircleIcon,
  CircleNotchIcon,
  DesktopIcon,
  UploadSimpleIcon,
  WarningCircleIcon,
  XIcon,
} from "@phosphor-icons/react";
import { type ChangeEvent, type DragEvent, useCallback, useEffect, useRef, useState } from "react";

import { addWidget, importCustomWidget } from "@/core/ipc";
import type { Manifest } from "@/core/types";

export interface ImportWidgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess?: (manifest: Manifest) => void;
  onAddToDesktop?: (manifest: Manifest) => void;
}

type ImportStatus = "idle" | "loading" | "error" | "success";

export function ImportWidgetModal({
  isOpen,
  onClose,
  onImportSuccess,
  onAddToDesktop,
}: ImportWidgetModalProps) {
  const [status, setStatus] = useState<ImportStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importedManifest, setImportedManifest] = useState<Manifest | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClose = useCallback(() => {
    setStatus("idle");
    setErrorMessage(null);
    setImportedManifest(null);
    setIsDragOver(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && status !== "loading") {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, status, handleClose]);

  const processFile = useCallback(
    (file: File) => {
      const lowerName = file.name.toLowerCase();
      const isValidExt =
        lowerName.endsWith(".html") || lowerName.endsWith(".nook") || lowerName.endsWith(".zip");

      if (!isValidExt) {
        setErrorMessage(
          `Unsupported file format: "${file.name}". Please upload a .html, .nook, or .zip widget file.`,
        );
        setStatus("error");
        return;
      }

      setStatus("loading");
      setErrorMessage(null);

      const reader = new FileReader();
      reader.addEventListener("load", async () => {
        try {
          const buffer = reader.result as ArrayBuffer;
          const uint8Array = new Uint8Array(buffer);
          const manifest = await importCustomWidget(uint8Array, file.name);
          setImportedManifest(manifest);
          setStatus("success");
          onImportSuccess?.(manifest);
        } catch (err: unknown) {
          const msg =
            err instanceof Error
              ? err.message
              : typeof err === "string"
                ? err
                : "Failed to import custom widget.";
          setErrorMessage(msg);
          setStatus("error");
        }
      });

      reader.addEventListener("error", () => {
        setErrorMessage("Failed to read file from disk.");
        setStatus("error");
      });

      reader.readAsArrayBuffer(file);
    },
    [onImportSuccess],
  );

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (status === "loading") return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    e.target.value = "";
  };

  const handleAddToDesktop = async () => {
    if (!importedManifest) return;
    if (onAddToDesktop) {
      onAddToDesktop(importedManifest);
    } else {
      try {
        await addWidget(importedManifest.id);
      } catch {
        // Ignore
      }
    }
    handleClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex animate-appear items-center justify-center bg-black/60 p-4 backdrop-blur-xs select-none"
      onClick={() => {
        if (status !== "loading") {
          handleClose();
        }
      }}
    >
      <div
        className="relative flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6 shadow-card inline-full max-inline-md"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-widget-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 id="import-widget-title" className="text-sm font-semibold text-fg">
              Import Custom Widget
            </h2>
            <p className="text-sub text-fg-muted">
              Add standalone HTML widgets or packaged bundles (.nook / .zip)
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={status === "loading"}
            className="flex cursor-pointer items-center justify-center rounded-lg p-1 text-fg-muted transition-colors hover:bg-surface-raised hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Close"
          >
            <XIcon className="block-4 inline-4" />
          </button>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".html,.nook,.zip"
          tabIndex={-1}
          onChange={handleFileInputChange}
          className="hidden"
          aria-hidden="true"
        />

        {/* Idle State: Drag & Drop Zone */}
        {status === "idle" && (
          <div
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            tabIndex={0}
            role="button"
            aria-label="Drop a .html, .nook, or .zip widget file here, or click to browse"
            className={`
              group flex cursor-pointer flex-col items-center justify-center
              gap-3 rounded-xl border-2 border-dashed p-8 text-center
              transition-all outline-none
              ${
                isDragOver
                  ? "border-accent-500 bg-accent-500/10"
                  : `
                  border-line/80 bg-surface-raised/40
                  hover:border-accent-500/60 hover:bg-surface-raised/70
                  focus-visible:border-accent-500 focus-visible:ring-2
                  focus-visible:ring-accent-500/20
                `
              }
            `}
          >
            <div className="flex items-center justify-center rounded-full bg-accent-500/15 p-3 text-accent-500 transition-transform block-12 inline-12 group-hover:scale-105">
              <UploadSimpleIcon className="block-6 inline-6" weight="bold" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-fg">
                Drop a .html, .nook, or .zip widget file here, or click to browse
              </span>
              <span className="text-3xs text-fg-muted">
                Accepts standalone .html widgets or .nook/.zip packages with manifest.json
              </span>
            </div>
          </div>
        )}

        {/* Loading State */}
        {status === "loading" && (
          <div className="flex flex-col items-center justify-center gap-3.5 py-10 text-center">
            <CircleNotchIcon className="animate-spin text-accent-500 block-9 inline-9" />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-fg">
                Importing and validating widget package...
              </span>
              <span className="text-3xs text-fg-muted">
                Unpacking files, validating sandbox structure, and registering manifest
              </span>
            </div>
          </div>
        )}

        {/* Error State */}
        {status === "error" && (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3 rounded-xl border border-error/40 bg-error/10 p-3.5 text-xs text-error">
              <WarningCircleIcon
                className="mbs-0.5 shrink-0 text-error block-4 inline-4"
                weight="fill"
              />
              <div className="flex flex-1 flex-col gap-1">
                <span className="font-semibold text-fg">Widget Import Failed</span>
                <span className="wrap-break-word text-fg-muted">
                  {errorMessage || "An unknown error occurred while importing the widget."}
                </span>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="cursor-pointer rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:bg-surface-raised hover:text-fg"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatus("idle");
                  setErrorMessage(null);
                }}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-accent-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-accent-600 active:scale-95"
              >
                <ArrowClockwiseIcon className="block-3.5 inline-3.5" />
                <span>Try again</span>
              </button>
            </div>
          </div>
        )}

        {/* Success State */}
        {status === "success" && importedManifest && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 rounded-lg border border-ok/30 bg-ok/10 px-3 py-2 text-xs font-medium text-ok">
              <CheckCircleIcon className="shrink-0 block-4 inline-4" weight="fill" />
              <span>Widget imported successfully!</span>
            </div>

            {/* Imported Widget Card */}
            <div className="flex flex-col gap-2.5 rounded-xl border border-line/80 bg-surface-raised/50 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-fg">{importedManifest.name}</span>
                  <span className="font-mono text-3xs text-fg-muted">
                    ID: {importedManifest.id}
                  </span>
                </div>
                <span className="shrink-0 rounded-md bg-accent-500/15 px-2 py-0.5 font-mono text-3xs font-semibold text-accent-400">
                  v{importedManifest.version}
                </span>
              </div>

              <div className="flex items-center gap-1 text-2xs text-fg-muted">
                <span>By</span>
                <span className="font-medium text-fg">{importedManifest.author || "Unknown"}</span>
              </div>

              {importedManifest.description && (
                <p className="text-xs/relaxed text-fg-muted">{importedManifest.description}</p>
              )}

              {importedManifest.settingsSchema && importedManifest.settingsSchema.length > 0 && (
                <div className="border-bs border-line/50 pbs-2 text-3xs text-fg-muted">
                  Includes {importedManifest.settingsSchema.length} configurable setting
                  {importedManifest.settingsSchema.length === 1 ? "" : "s"}
                </div>
              )}
            </div>

            {/* Success Actions */}
            <div className="flex items-center justify-end gap-2.5 pbs-1">
              <button
                type="button"
                onClick={handleClose}
                className="cursor-pointer rounded-lg border border-line bg-surface px-3.5 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:bg-surface-raised hover:text-fg"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => void handleAddToDesktop()}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-accent-500 px-4 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-accent-600 active:scale-95"
              >
                <DesktopIcon className="block-3.5 inline-3.5" />
                <span>Add to Desktop Now</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
