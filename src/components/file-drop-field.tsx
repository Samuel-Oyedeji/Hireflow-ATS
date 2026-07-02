import { useRef, useState } from "react";
import { FileText, Upload, X } from "lucide-react";

import { Label } from "@/components/ui/label";

/**
 * Single-file drag / drop / browse field that captures the picked file's name.
 * Files are not actually uploaded in this demo — only the file name is stored,
 * matching the rest of the app.
 */
export function FileDropField({
  label,
  optional,
  fileName,
  accept = ".pdf,.doc,.docx",
  hint = "PDF, DOCX",
  onPick,
  onPickFile,
  onClear,
}: {
  label: string;
  optional?: boolean;
  fileName?: string;
  accept?: string;
  hint?: string;
  onPick: (name: string) => void;
  onPickFile?: (file: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  function pick(f: File) {
    onPick(f.name);
    onPickFile?.(f);
  }

  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-2">
        {label}
        {optional && <span className="text-xs font-normal text-muted-foreground">(optional)</span>}
      </Label>
      {fileName ? (
        <div className="flex items-center gap-3 rounded-md border border-border bg-secondary/40 px-3 py-2.5">
          <FileText className="h-4 w-4 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate text-sm text-foreground">{fileName}</span>
          <button
            type="button"
            aria-label="Remove file"
            onClick={onClear}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files?.[0];
            if (f) pick(f);
          }}
          className={`flex w-full items-center justify-center gap-2 rounded-md border border-dashed px-3 py-4 text-sm transition-colors ${
            drag ? "border-primary bg-accent" : "border-border bg-card hover:bg-secondary/50"
          }`}
        >
          <Upload className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">
            Drag &amp; drop or <span className="text-primary">browse</span> · {hint}
          </span>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) pick(f);
            }}
          />
        </button>
      )}
    </div>
  );
}
