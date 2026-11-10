// 認定タイムスタンプを後から付けるための差し込み口。
// 事業者（例: 認定タイムスタンプ局）が決まったら TimestampProvider を実装して signContract に渡す。
// 締結済みの契約に後から付ける場合は、signed_pdf_sha256 を stamp() に渡して contracts の timestamp_* を更新する。

export type TimestampResult = {
  /** タイムスタンプトークン（RFC 3161 の応答を base64 にしたものなど） */
  token: string;
  authority: string;
  at: string;
};

export interface TimestampProvider {
  stamp(sha256Hex: string): Promise<TimestampResult | null>;
}

/** 付けない（既定） */
export const noTimestamp: TimestampProvider = {
  async stamp() {
    return null;
  },
};
