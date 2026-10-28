"use client";

import {
  CheckCircle2Icon,
  DownloadIcon,
  FileUpIcon,
  Loader2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "@/i18n";
import { useMessages, useT } from "@/i18n/provider";
import { formatINR } from "@/lib/money";
import { checkImportAction, runImportAction, type ImportPreview } from "../actions";

const MAX_BYTES = 1_000_000;

export function ImportItems() {
  const m = useMessages();
  const t = useT();
  const router = useRouter();
  const inputId = useId();
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [checking, startCheck] = useTransition();
  const [importing, startImport] = useTransition();

  const onFile = async (file: File | undefined) => {
    setPreview(null);
    setFileError(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) return setFileError(m.import.notCsv);
    if (file.size > MAX_BYTES) return setFileError(m.import.tooBig);
    const text = await file.text();
    setCsv(text);
    setFileName(file.name);
    const formData = new FormData();
    formData.set("csv", text);
    startCheck(async () => {
      const result = await checkImportAction(formData);
      if (result.ok && result.data) setPreview(result.data);
      else if (!result.ok && result.message)
        setFileError(t(result.message.key, result.message.vars));
    });
  };

  const runImport = () => {
    if (!csv) return;
    const formData = new FormData();
    formData.set("csv", csv);
    startImport(async () => {
      const result = await runImportAction(formData);
      if (result.ok) {
        if (result.message) toast.success(t(result.message.key, result.message.vars));
        router.push("/items?sort=recent");
      } else if (result.message) {
        toast.error(t(result.message.key, result.message.vars));
        setPreview(null);
      }
    });
  };

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{m.import.step1}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p>{m.import.step1Body}</p>
          <p className="text-sm text-muted-foreground">{m.import.columnsHelpBody}</p>
          <Button variant="outline" size="lg" asChild className="w-fit">
            <a href="/item-import-template.csv" download="items-sample.csv">
              <DownloadIcon aria-hidden />
              {m.import.downloadTemplate}
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{m.import.step2}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p>{m.import.step2Body}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" asChild className="w-fit" disabled={checking || importing}>
              <label htmlFor={inputId} className="cursor-pointer">
                {checking ? (
                  <Loader2Icon className="animate-spin" aria-hidden />
                ) : (
                  <FileUpIcon aria-hidden />
                )}
                {checking ? m.import.checking : m.import.chooseFile}
              </label>
            </Button>
            {fileName && <span className="text-sm text-muted-foreground">{fileName}</span>}
          </div>
          <input
            id={inputId}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {fileError && (
            <p role="alert" className="font-medium text-destructive">
              {fileError}
            </p>
          )}
        </CardContent>
      </Card>

      {preview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{m.import.step3}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {preview.totalProblems > 0 ? (
              <Alert variant="destructive">
                <TriangleAlertIcon aria-hidden />
                <AlertTitle className="text-base">{m.import.problemsTitle}</AlertTitle>
                <AlertDescription>
                  <ProblemTable preview={preview} />
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <Alert>
                  <CheckCircle2Icon aria-hidden className="text-success" />
                  <AlertTitle className="text-base">
                    {format(m.import.ready, { count: preview.count })}
                  </AlertTitle>
                  <AlertDescription>
                    {format(m.import.readyDetails, {
                      brands: preview.newBrands,
                      categories: preview.newCategories,
                      withStock: preview.withStock,
                    })}
                  </AlertDescription>
                </Alert>
                <div>
                  <p className="mb-2 text-sm font-medium text-muted-foreground">
                    {m.import.preview}
                  </p>
                  <ul className="divide-y rounded-lg border text-sm">
                    {preview.sample.map((row) => (
                      <li key={row.row} className="flex justify-between gap-3 px-3 py-2">
                        <span>
                          {row.name}
                          {row.variant && ` – ${row.variant}`}
                          {row.packSize && (
                            <span className="text-muted-foreground"> · {row.packSize}</span>
                          )}
                        </span>
                        {row.mrpPaise != null && <span>{formatINR(row.mrpPaise)}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
                <Button
                  size="lg"
                  onClick={runImport}
                  disabled={importing}
                  className="w-full sm:w-fit"
                >
                  {importing && <Loader2Icon className="animate-spin" aria-hidden />}
                  {importing
                    ? m.import.importing
                    : format(m.import.importButton, { count: preview.count })}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ProblemTable({ preview }: { preview: ImportPreview }) {
  const m = useMessages();
  const t = useT();
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            <th className="py-1 pr-3">{m.import.row}</th>
            <th className="py-1 pr-3">{m.import.column}</th>
            <th className="py-1">{m.import.problem}</th>
          </tr>
        </thead>
        <tbody>
          {preview.problems.map((p, i) => (
            <tr key={i} className="border-t border-destructive/20 align-top">
              <td className="py-1 pr-3 font-medium">{p.row ?? m.import.fileLevel}</td>
              <td className="py-1 pr-3">{p.column ?? "—"}</td>
              <td className="py-1">{t(p.key, p.vars)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {preview.totalProblems > preview.problems.length && (
        <p className="mt-2">
          {format(m.import.problemsMore, {
            count: preview.totalProblems - preview.problems.length,
          })}
        </p>
      )}
    </div>
  );
}
