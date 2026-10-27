import React from "react";
import { Download, FolderOpen, Trash2, Wrench } from "lucide-react";
import { Section } from "../ui/Field";

export default function FilePanel({ draftStatus, onExportJson, onImportJson, onClearDraft, onRepairSwap }) {
  return (
    <div className="panel-body">
      <div className="callout">
        作品自動儲存在這個瀏覽器{draftStatus ? `（${draftStatus}）` : ""}。換裝置或清除瀏覽器資料前，請先匯出專案檔備份。
      </div>

      <Section title="專案檔">
        <div className="list-actions">
          <button type="button" className="list-action" onClick={onExportJson}>
            <Download size={18} strokeWidth={1.8} aria-hidden="true" />
            <span>
              <strong>匯出專案檔</strong>
              <small>含照片的 .json，可在其他裝置繼續編輯</small>
            </span>
          </button>
          <button type="button" className="list-action" onClick={onImportJson}>
            <FolderOpen size={18} strokeWidth={1.8} aria-hidden="true" />
            <span>
              <strong>開啟專案檔</strong>
              <small>會取代目前畫布</small>
            </span>
          </button>
          {onRepairSwap && (
            <button type="button" className="list-action" onClick={onRepairSwap}>
              <Wrench size={18} strokeWidth={1.8} aria-hidden="true" />
              <span>
                <strong>修復置換對齊</strong>
                <small>保留照片，重設中心方形位置</small>
              </span>
            </button>
          )}
        </div>
      </Section>

      <Section title="危險區域">
        <button type="button" className="list-action list-action--danger" onClick={onClearDraft}>
          <Trash2 size={18} strokeWidth={1.8} aria-hidden="true" />
          <span>
            <strong>清除所有資料</strong>
            <small>刪除這個瀏覽器裡的照片、畫布與草稿</small>
          </span>
        </button>
      </Section>
    </div>
  );
}
