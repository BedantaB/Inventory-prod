"use client";

import { CameraIcon, Loader2Icon, Trash2Icon } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { useMessages } from "@/i18n/provider";
import { compressPhoto } from "./compress-photo";
import { ItemPhoto } from "./item-photo";

export type PickedPhoto = { full: Blob; thumb: Blob } | null;

/**
 * Take a photo with the phone camera or choose one. The photo is resized right away;
 * the parent form adds it to the upload (see ItemForm's prepareFormData).
 */
export function PhotoPicker({
  existingPath,
  onChange,
  error,
}: {
  existingPath: string | null;
  onChange: (photo: PickedPhoto, removeExisting: boolean) => void;
  error?: string;
}) {
  const m = useMessages();
  const inputId = useId();
  const [preview, setPreview] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setLocalError(null);
    try {
      const photo = await compressPhoto(file);
      setPreview(URL.createObjectURL(photo.thumb));
      setRemoved(false);
      onChange(photo, false);
    } catch {
      setLocalError(m.items.photoNotImage);
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    setPreview(null);
    setRemoved(true);
    onChange(null, true);
  };

  const showing = preview ?? (!removed && existingPath ? "existing" : null);
  const message = localError ?? error;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-base font-medium">
        {m.items.photo}{" "}
        <span className="font-normal text-muted-foreground">({m.common.optional})</span>
      </span>
      <div className="flex items-center gap-4">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="size-20 rounded-lg object-cover" />
        ) : (
          <ItemPhoto path={showing ? existingPath : null} alt="" className="size-20" />
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" asChild>
            <label htmlFor={inputId} className="cursor-pointer">
              {busy ? (
                <Loader2Icon className="animate-spin" aria-hidden />
              ) : (
                <CameraIcon aria-hidden />
              )}
              {busy ? m.items.preparingPhoto : showing ? m.items.changePhoto : m.items.addPhoto}
            </label>
          </Button>
          {showing && (
            <Button type="button" variant="ghost" onClick={remove}>
              <Trash2Icon aria-hidden />
              {m.items.removePhoto}
            </Button>
          )}
        </div>
      </div>
      {/* No name: the resized copies are sent instead of the original. */}
      <input
        id={inputId}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {message && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {message}
        </p>
      )}
    </div>
  );
}
