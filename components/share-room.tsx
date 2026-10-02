"use client";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Share2 } from "lucide-react";
export function ShareRoom({
  code,
  large = false,
}: {
  code: string;
  large?: boolean;
}) {
  const [url, setUrl] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => setUrl(`${window.location.origin}/r/${code}`), [code]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setNotice("連結已複製！");
    } catch {
      setNotice("請長按下方連結複製");
    }
  }
  async function share() {
    try {
      if (navigator.share)
        await navigator.share({
          title: "Party Room 今晚一起玩！",
          text: `來房間 ${code}，朋友都在等你！`,
          url,
        });
      else await copy();
    } catch {
      setNotice("已取消分享");
    }
  }
  return (
    <div className={`share-box ${large ? "large" : ""}`}>
      <div className="qr-frame">
        {url && (
          <QRCodeSVG
            value={url}
            size={large ? 188 : 136}
            bgColor="#fffdf7"
            fgColor="#292535"
            level="M"
          />
        )}
      </div>
      <div className="share-content">
        <p className="eyebrow">SCAN. JOIN. PLAY.</p>
        <p>掃一下，一起進來玩</p>
        <div className="button-row">
          <button
            className="icon-button"
            aria-label="複製房間連結"
            onClick={() => void copy()}
          >
            <Copy size={18} />
          </button>
          <button
            className="icon-button"
            aria-label="分享房間"
            onClick={() => void share()}
          >
            <Share2 size={18} />
          </button>
          <a
            className="line-button"
            href={`https://line.me/R/msg/text/?${encodeURIComponent(`今晚一起玩！房號 ${code} ${url}`)}`}
            target="_blank"
            rel="noreferrer"
          >
            LINE
          </a>
        </div>
        <small role="status">{notice || "不用註冊，暱稱就是你的入場券"}</small>
        {notice === "請長按下方連結複製" && (
          <input readOnly value={url} aria-label="房間分享連結" />
        )}
      </div>
    </div>
  );
}
