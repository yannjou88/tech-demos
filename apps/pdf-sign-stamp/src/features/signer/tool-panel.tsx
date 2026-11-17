"use client";

/* Canvas signatures and stamps are data URLs, not remote images. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Pair } from "@/features/signer/bilingual";
import { SignaturePad } from "@/features/signer/signature-pad";
import type { Draft, MarkKind } from "@/features/signer/types";
import { DATE_FORMATS, formatStampDate, type DateFormatId } from "@/lib/dates";
import {
  fontFamily,
  HANDWRITING_FONTS,
  imageFileToPng,
  inkHex,
  INKS,
  renderSeal,
  renderTextStamp,
  type FontId,
  type InkId,
} from "@/lib/raster";
import { clearSignatures, rememberSignature, type SavedSignature } from "@/lib/storage";

export function ToolPanel({
  saved,
  onSaved,
  onDraft,
}: {
  saved: SavedSignature[];
  onSaved: (next: SavedSignature[]) => void;
  onDraft: (draft: Draft) => void;
}) {
  const [ink, setInk] = useState<InkId>("black");
  const [font, setFont] = useState<FontId>("ma-shan-zheng");
  const [typed, setTyped] = useState("");
  const [typedPreview, setTypedPreview] = useState<{
    key: string;
    dataUrl: string;
  } | null>(null);
  const [remember, setRemember] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);
  const [dateFormat, setDateFormat] = useState<DateFormatId>("zh");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [sealCenter, setSealCenter] = useState("已签");
  const [sealRing, setSealRing] = useState("APPROVED");
  const [sealPreview, setSealPreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  useEffect(() => {
    const text = typed.trim();
    if (!text) return;
    let cancelled = false;
    const key = `${text}\n${font}\n${ink}`;
    void renderTextStamp({
      text,
      fontFamily: fontFamily(font),
      color: inkHex(ink),
    }).then((raster) => {
      if (!cancelled) setTypedPreview({ key, dataUrl: raster.dataUrl });
    });
    return () => {
      cancelled = true;
    };
  }, [typed, font, ink]);

  useEffect(() => {
    let cancelled = false;
    void renderSeal(sealCenter, sealRing).then((raster) => {
      if (!cancelled) setSealPreview(raster.dataUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [sealCenter, sealRing]);

  function armSignature(dataUrl: string, bitmapAspect: number) {
    if (remember) {
      const item: SavedSignature = {
        id: crypto.randomUUID(),
        dataUrl,
        createdAt: new Date().toISOString(),
      };
      try {
        onSaved(rememberSignature(localStorage, item));
      } catch {
        // A full localStorage should not block placing the signature.
      }
    }
    onDraft({ kind: "signature", dataUrl, bitmapAspect, lockAspect: true });
  }

  async function armText(kind: MarkKind, text: string, family: string, background = false) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const raster = await renderTextStamp({
      text: trimmed,
      fontFamily: family,
      color: "#1c1917",
      background,
      fontSize: kind === "text" ? 48 : 72,
      maxWidth: kind === "text" ? 640 : 900,
    });
    onDraft({ kind, ...raster, lockAspect: true });
  }

  return (
    <div className="flex flex-col gap-4 p-3 md:p-4">
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-medium">
          <Pair zh="签名" en="Signature" />
        </h2>
        <Tabs defaultValue="draw">
          <TabsList className="h-auto w-full">
            <TabsTrigger value="draw" className="h-10" data-testid="tab-draw">
              手写
            </TabsTrigger>
            <TabsTrigger value="type" className="h-10" data-testid="tab-type">
              打字
            </TabsTrigger>
            <TabsTrigger value="image" className="h-10" data-testid="tab-image">
              图片
            </TabsTrigger>
          </TabsList>
          <TabsContent value="draw" className="pt-3">
            <SignaturePad
              color={inkHex(ink)}
              onPlace={(dataUrl, bitmapAspect) => armSignature(dataUrl, bitmapAspect)}
            />
          </TabsContent>
          <TabsContent value="type" className="flex flex-col gap-3 pt-3">
            <Label htmlFor="typed-signature">
              <Pair zh="写下你的名字" en="Type your name" />
            </Label>
            <Input
              id="typed-signature"
              data-testid="sig-text"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              className="h-11"
              placeholder="陈静"
              style={{ fontFamily: fontFamily(font) }}
            />
            <div className="flex flex-wrap gap-2">
              {HANDWRITING_FONTS.map((item) => (
                <Button
                  key={item.id}
                  type="button"
                  variant={font === item.id ? "default" : "outline"}
                  className="h-11 px-3"
                  data-testid={`font-${item.id}`}
                  onClick={() => setFont(item.id)}
                >
                  <span style={{ fontFamily: item.family }}>{item.zh}</span>
                </Button>
              ))}
            </div>
            {typedPreview?.key === `${typed.trim()}\n${font}\n${ink}` ? (
              <img
                src={typedPreview.dataUrl}
                alt=""
                className="h-16 w-fit max-w-full object-contain"
              />
            ) : null}
            <Button
              type="button"
              className="h-11"
              data-testid="place-typed"
              disabled={!typed.trim()}
              onClick={() => {
                void renderTextStamp({
                  text: typed.trim(),
                  fontFamily: fontFamily(font),
                  color: inkHex(ink),
                }).then((raster) => armSignature(raster.dataUrl, raster.bitmapAspect));
              }}
            >
              <Pair zh="用这个签名" en="Use this signature" />
            </Button>
          </TabsContent>
          <TabsContent value="image" className="flex flex-col gap-3 pt-3">
            <Label htmlFor="sig-image">
              <Pair zh="上传签名图片" en="Upload a PNG or photo" />
            </Label>
            <Input
              id="sig-image"
              data-testid="sig-image"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="h-11 py-2"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                setImageError(null);
                void imageFileToPng(file)
                  .then((raster) => armSignature(raster.dataUrl, raster.bitmapAspect))
                  .catch(() => setImageError("这张图片打不开。 / Could not read that image."));
              }}
            />
            {imageError ? <p className="text-sm text-destructive">{imageError}</p> : null}
          </TabsContent>
        </Tabs>
        <div className="flex flex-wrap gap-2" role="group" aria-label="墨色 / Ink">
          {INKS.map((item) => (
            <Button
              key={item.id}
              type="button"
              variant={ink === item.id ? "default" : "outline"}
              className="h-11 px-3"
              data-testid={`ink-${item.id}`}
              onClick={() => setInk(item.id)}
            >
              <span
                className="size-3.5 rounded-full border border-black/10"
                style={{ background: item.hex }}
              />
              <Pair zh={item.zh} en={item.en} />
            </Button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
          />
          <Pair zh="记住这个签名" en="Remember on this device" />
        </label>
        {saved.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm">
              <Pair zh="已保存的签名" en="Saved signatures" />
            </p>
            <div className="flex gap-2 overflow-x-auto">
              {saved.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="shrink-0 rounded-lg border bg-white p-1"
                  onClick={() => {
                    const image = new Image();
                    image.onload = () => {
                      onDraft({
                        kind: "signature",
                        dataUrl: item.dataUrl,
                        bitmapAspect: image.width / image.height,
                        lockAspect: true,
                      });
                    };
                    image.src = item.dataUrl;
                  }}
                >
                  <img src={item.dataUrl} alt="" className="h-12 w-24 object-contain" />
                </button>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              data-testid="clear-signatures"
              onClick={() => {
                if (!confirmClear) {
                  setConfirmClear(true);
                  window.setTimeout(() => setConfirmClear(false), 4000);
                  return;
                }
                clearSignatures(localStorage);
                onSaved([]);
                setConfirmClear(false);
              }}
            >
              <Pair
                zh={confirmClear ? "再点一次，确认清除" : "清除全部已存签名"}
                en={confirmClear ? "Tap again to confirm" : "Clear saved signatures"}
              />
            </Button>
          </div>
        ) : null}
      </section>

      <section className="flex flex-col gap-2 border-t pt-4">
        <h2 className="text-base font-medium">
          <Pair zh="日期" en="Date" />
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {DATE_FORMATS.map((item) => (
            <Button
              key={item.id}
              type="button"
              variant={dateFormat === item.id ? "default" : "outline"}
              className="h-11"
              data-testid={`date-${item.id}`}
              onClick={() => setDateFormat(item.id)}
            >
              {formatStampDate(new Date(), item.id)}
            </Button>
          ))}
        </div>
        <Button
          type="button"
          className="h-11"
          data-testid="place-date"
          onClick={() => {
            void armText(
              "date",
              formatStampDate(new Date(), dateFormat),
              dateFormat === "zh" ? "Ma Shan Zheng" : "Caveat",
            );
          }}
        >
          <Pair zh="放上今天的日期" en="Place today's date" />
        </Button>
      </section>

      <section className="flex flex-col gap-2 border-t pt-4">
        <h2 className="text-base font-medium">
          <Pair zh="姓名" en="Name" />
        </h2>
        <Input
          data-testid="name-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="h-11"
          placeholder="你的名字 / Your name"
          style={{ fontFamily: "Ma Shan Zheng" }}
        />
        <Button
          type="button"
          className="h-11"
          data-testid="place-name"
          disabled={!name.trim()}
          onClick={() => {
            void armText("name", name, "Ma Shan Zheng");
          }}
        >
          <Pair zh="放上姓名" en="Place name" />
        </Button>
      </section>

      <section className="flex flex-col gap-2 border-t pt-4">
        <h2 className="text-base font-medium">
          <Pair zh="文字" en="Text" />
        </h2>
        <Textarea
          data-testid="note-input"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="写一句想印在文件上的话 / A short note"
          rows={3}
        />
        <Button
          type="button"
          className="h-11"
          data-testid="place-text"
          disabled={!note.trim()}
          onClick={() => {
            void armText("text", note, "Ma Shan Zheng", true);
          }}
        >
          <Pair zh="放上文字" en="Place text" />
        </Button>
      </section>

      <section className="flex flex-col gap-2 border-t pt-4">
        <h2 className="text-base font-medium">
          <Pair zh="印章" en="Seal" />
        </h2>
        <Label htmlFor="seal-center">
          <Pair zh="中间的字" en="Center" />
        </Label>
        <Input
          id="seal-center"
          data-testid="seal-center"
          value={sealCenter}
          maxLength={4}
          onChange={(event) => setSealCenter(event.target.value)}
          className="h-11"
        />
        <Label htmlFor="seal-ring">
          <Pair zh="外圈的字" en="Ring" />
        </Label>
        <Input
          id="seal-ring"
          data-testid="seal-ring"
          value={sealRing}
          maxLength={18}
          onChange={(event) => setSealRing(event.target.value)}
          className="h-11"
        />
        {sealPreview ? (
          <img src={sealPreview} alt="" className="size-28 object-contain" />
        ) : null}
        <Button
          type="button"
          className="h-11"
          data-testid="place-seal"
          onClick={() => {
            void renderSeal(sealCenter, sealRing).then((raster) => {
              onDraft({ kind: "seal", ...raster, lockAspect: true });
            });
          }}
        >
          <Pair zh="放上印章" en="Place seal" />
        </Button>
      </section>
    </div>
  );
}
