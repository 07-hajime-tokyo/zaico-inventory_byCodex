/**
 * ============================================================
 * FedEx 発送管理 GAS スクリプト（発送管理専用版）
 * ============================================================
 *
 * 【使い方】
 * 1. Google スプレッドシートを開く
 * 2. 拡張機能 → Apps Script を開く
 * 3. このコードを貼り付けて保存
 * 4. 「プロジェクトの設定」→「スクリプトプロパティ」に
 *    キー: GAS_WEBHOOK_SECRET
 *    値: （サイトの GAS_WEBHOOK_SECRET と同じ値）
 *    を追加してください
 * 5. 「ウェブアプリとして導入」でデプロイし、URLをサイトの
 *    GAS_WEBHOOK_URL に設定してください
 *
 * 【スプレッドシート構造（独発送管理・サミー発送管理共通）】
 *   1行目: ヘッダー（インボイスNo., 支払い, 商品名日本語, 商品名英語, 発注数, shipped, [発送日1], [発送日2], ...）
 *   2行目: ラベル（invoice, Date of payment, ..., shipped, [発送日1], [発送日2], ...）
 *   3行目: 追跡番号行（..., [追跡番号1], [追跡番号2], ...）
 *   4行目以降: データ行
 *
 * 【書き込みロジック】
 * - G列（7列目）以降に発送日・追跡番号が並ぶ
 * - 新規登録: 最後の列の次の列に書き込む
 *   - 2行目: 発送日
 *   - 3行目: 追跡番号
 *   - 4行目以降: インボイスNo.と商品名を照合して出庫数を書き込む
 * ============================================================
 */

// ============================================================
// Webhook エントリーポイント（doPost）
// ============================================================

/**
 * サイトから呼び出される Webhook
 *
 * 対応アクション:
 *   "writeShipmentBatch"  → FedEx発送情報を新規書き込み
 *   "updateShipmentBatch" → 既存の発送情報を更新
 *   "deleteShipmentBatch" → 発送情報を削除（列をクリア）
 *
 * リクエスト JSON 例（writeShipmentBatch）:
 * {
 *   "secret": "...",
 *   "action": "writeShipmentBatch",
 *   "deliveryNo": "375_luca2026036",
 *   "invoiceNo": "375",
 *   "sheetName": "独発送管理",
 *   "shippingDate": "4/8",
 *   "trackingNumber": "7489123456789",
 *   "items": [
 *     { "productNameJa": "PS Vita 2000 ランダムカラー", "productNameEn": "PS Vita 2000 Random color", "quantity": 5 }
 *   ]
 * }
 *
 * リクエスト JSON 例（updateShipmentBatch）:
 * {
 *   "secret": "...",
 *   "action": "updateShipmentBatch",
 *   "sheetName": "独発送管理",
 *   "oldTrackingNumber": "7489123456789",
 *   "trackingNumber": "7489999999999",
 *   "shippingDate": "4/9",
 *   "invoiceNo": "375",
 *   "items": [...]
 * }
 *
 * リクエスト JSON 例（deleteShipmentBatch）:
 * {
 *   "secret": "...",
 *   "action": "deleteShipmentBatch",
 *   "sheetName": "独発送管理",
 *   "trackingNumber": "7489123456789"
 * }
 */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);

    // シークレット認証（スクリプトプロパティ優先、なければハードコード値）
    const secret = PropertiesService.getScriptProperties().getProperty("GAS_WEBHOOK_SECRET") || "";
    if (!secret || body.secret !== secret) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, message: "認証エラー" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const action = body.action;

    if (action === "writeShipmentBatch") {
      const result = writeShipmentBatch(body);
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "updateShipmentBatch") {
      const result = updateShipmentBatch(body);
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "deleteShipmentBatch") {
      const result = deleteShipmentBatch(body);
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ success: false, message: "不明なアクション: " + action }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    Logger.log("doPost エラー: " + err.toString());
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================================
// 新規書き込み
// ============================================================

/**
 * FedEx発送情報をスプシに書き込む（新規列追加）
 *
 * @param {Object} params
 * @param {string} params.invoiceNo      - インボイス番号（例: "375"）
 * @param {string} params.sheetName      - シート名（"独発送管理" or "サミー発送管理"）
 * @param {string} params.shippingDate   - 発送日（例: "4/8"）
 * @param {string} params.trackingNumber - FedEx追跡番号
 * @param {Array}  params.items          - 商品リスト [{productNameJa, productNameEn, quantity}]
 */
function writeShipmentBatch(params) {
  const { invoiceNo, sheetName, shippingDate, trackingNumber, items } = params;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    return { success: false, message: "シート「" + sheetName + "」が見つかりません" };
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  // G列（7列目）以降に発送日・追跡番号が並ぶ
  const FIXED_COLS = 7;

  // 既存列に同じ追跡番号があれば再利用、なければ新しい列を追加
  let targetCol = -1;
  if (lastCol >= FIXED_COLS + 1) {
    const row3Values = sheet.getRange(3, FIXED_COLS + 1, 1, lastCol - FIXED_COLS).getValues()[0];
    for (let i = 0; i < row3Values.length; i++) {
      if (String(row3Values[i]).trim() === String(trackingNumber).trim()) {
        targetCol = FIXED_COLS + 1 + i;
        break;
      }
    }
  }
  const isNewCol = targetCol === -1;
  const nextCol = isNewCol ? lastCol + 1 : targetCol;

  // 新しい列の場合のみ発送日・追跡番号を書き込む
  if (isNewCol) {
    sheet.getRange(2, nextCol).setValue(shippingDate);
    sheet.getRange(3, nextCol).setValue(trackingNumber);
  }

  // インボイスNoと商品名を照合して各行に出庫数を書き込む
  const COL_INVOICE_SHEET = 2;  // B列: インボイスNo.
  const COL_NAME_JA_SHEET = 4;  // D列: 商品名（日本語）
  const COL_NAME_EN_SHEET = 5;  // E列: 商品名（英語）

  if (lastRow < 4) {
    return { success: true, message: "発送日と追跡番号を書き込みました（データ行なし）" };
  }

  const dataRange = sheet.getRange(4, 1, lastRow - 3, Math.max(lastCol, nextCol));
  const dataValues = dataRange.getValues();

  let currentInvoice = "";
  let writtenCount = 0;
  const warnings = [];

  for (let rowIdx = 0; rowIdx < dataValues.length; rowIdx++) {
    const row = dataValues[rowIdx];
    // B列にインボイスNoがある行は現在のインボイスを更新
    const cellInvoice = String(row[COL_INVOICE_SHEET - 1] ?? "").trim();
    if (cellInvoice !== "") {
      currentInvoice = cellInvoice;
    }
    // インボイスNoが一致する行のみ処理
    if (currentInvoice !== String(invoiceNo).trim()) continue;

    const cellNameJa = String(row[COL_NAME_JA_SHEET - 1] ?? "").trim();
    const cellNameEn = String(row[COL_NAME_EN_SHEET - 1] ?? "").trim();

    for (let itemIdx = 0; itemIdx < items.length; itemIdx++) {
      const item = items[itemIdx];
      const itemNameJa = String(item.productNameJa ?? "").trim();
      const itemNameEn = String(item.productNameEn ?? "").trim();

      // 日本語名で部分一致（スペース・記号を正規化して照合）
      function normName(s) {
        return s.replace(/[\s　]+/g, "").replace(/[・･]/g, "").toLowerCase();
      }
      const normCellJa = normName(cellNameJa);
      const normItemJa = normName(itemNameJa);
      const matchJa = normCellJa !== "" && normItemJa !== "" && (
        normCellJa.includes(normItemJa) || normItemJa.includes(normCellJa)
      );

      if (matchJa) {
        const sheetRow = rowIdx + 4;
        sheet.getRange(sheetRow, nextCol).setValue(item.quantity);
        writtenCount++;
        break;
      }
    }
  }

  if (writtenCount === 0) {
    warnings.push("インボイスNo." + invoiceNo + "に一致する商品行が見つかりませんでした。発送日・追跡番号のみ書き込みました。");
  }

  const message = writtenCount > 0
    ? "インボイスNo." + invoiceNo + "の" + writtenCount + "商品に出庫数を書き込みました"
    : warnings.join(" ");

  return { success: true, message, writtenCount, warnings };
}

// ============================================================
// 更新
// ============================================================

/**
 * FedEx発送情報を更新する（追跡番号・発送日・商品数量を上書き）
 *
 * @param {Object} params
 * @param {string} params.sheetName          - シート名
 * @param {string} params.oldTrackingNumber  - 変更前の追跡番号（列を特定するために使用）
 * @param {string} params.trackingNumber     - 新しい追跡番号
 * @param {string} params.shippingDate       - 新しい発送日
 * @param {string} params.invoiceNo          - インボイス番号
 * @param {Array}  params.items              - 商品リスト [{productNameJa, productNameEn, quantity}]
 */
function updateShipmentBatch(params) {
  const { sheetName, oldTrackingNumber, trackingNumber, shippingDate, invoiceNo, items } = params;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    return { success: false, message: "シート「" + sheetName + "」が見つかりません" };
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  const FIXED_COLS = 7;

  // 3行目から旧追跡番号の列を探す（スプシ構造: 2行目=発送日, 3行目=追跡番号）
  if (lastCol < FIXED_COLS + 1) {
    return { success: false, message: "発送記録が見つかりません" };
  }
  const row3Values = sheet.getRange(3, FIXED_COLS + 1, 1, lastCol - FIXED_COLS).getValues()[0];
  let targetCol = -1;
  for (let i = 0; i < row3Values.length; i++) {
    if (String(row3Values[i]).trim() === String(oldTrackingNumber).trim()) {
      targetCol = FIXED_COLS + 1 + i;
      break;
    }
  }
  if (targetCol === -1) {
    return { success: false, message: "追跡番号「" + oldTrackingNumber + "」が見つかりません" };
  }

  // 2行目に発送日を上書き
  sheet.getRange(2, targetCol).setValue(shippingDate);
  // 3行目に新しい追跡番号を上書き
  sheet.getRange(3, targetCol).setValue(trackingNumber);

  // 商品数量を更新：まずその列の4行目以降をクリアしてから再書き込み
  if (lastRow >= 4) {
    sheet.getRange(4, targetCol, lastRow - 3, 1).clearContent();
  }

  const COL_INVOICE_SHEET = 2;
  const COL_NAME_JA_SHEET = 4;
  const COL_NAME_EN_SHEET = 5;

  if (lastRow < 4) {
    return { success: true, message: "発送日と追跡番号を更新しました" };
  }

  const dataRange = sheet.getRange(4, 1, lastRow - 3, Math.max(lastCol, targetCol));
  const dataValues = dataRange.getValues();

  let currentInvoice = "";
  let writtenCount = 0;

  for (let rowIdx = 0; rowIdx < dataValues.length; rowIdx++) {
    const row = dataValues[rowIdx];
    const cellInvoice = String(row[COL_INVOICE_SHEET - 1] ?? "").trim();
    if (cellInvoice !== "") currentInvoice = cellInvoice;
    if (currentInvoice !== String(invoiceNo).trim()) continue;

    const cellNameJa = String(row[COL_NAME_JA_SHEET - 1] ?? "").trim();
    const cellNameEn = String(row[COL_NAME_EN_SHEET - 1] ?? "").trim();

    for (let itemIdx = 0; itemIdx < items.length; itemIdx++) {
      const item = items[itemIdx];
      const itemNameJa = String(item.productNameJa ?? "").trim();
      function normName2(s) {
        return s.replace(/[\s\u3000]+/g, "").replace(/[\u30FB\uFF65]/g, "").toLowerCase();
      }
      const normCellJa2 = normName2(cellNameJa);
      const normItemJa2 = normName2(itemNameJa);
      const matchJa = normCellJa2 !== "" && normItemJa2 !== "" && (
        normCellJa2.includes(normItemJa2) || normItemJa2.includes(normCellJa2)
      );
      if (matchJa) {
        const sheetRow = rowIdx + 4;
        sheet.getRange(sheetRow, targetCol).setValue(item.quantity);
        writtenCount++;
        break;
      }
    }
  }

  return { success: true, message: "発送情報を更新しました（" + writtenCount + "商品）", writtenCount };
}

// ============================================================
// 削除
// ============================================================

/**
 * FedEx発送記録を削除する（追跡番号の列をクリア）
 *
 * @param {Object} params
 * @param {string} params.sheetName      - シート名
 * @param {string} params.trackingNumber - 削除する追跡番号
 */
function deleteShipmentBatch(params) {
  const { sheetName, trackingNumber } = params;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    return { success: false, message: "シート「" + sheetName + "」が見つかりません" };
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  const FIXED_COLS = 7;

  if (lastCol < FIXED_COLS + 1) {
    return { success: false, message: "発送記録が見つかりません" };
  }

  // 3行目から追跡番号の列を探す（スプシ構造: 2行目=発送日, 3行目=追跡番号）
  const row3Values = sheet.getRange(3, FIXED_COLS + 1, 1, lastCol - FIXED_COLS).getValues()[0];
  let targetCol = -1;
  for (let i = 0; i < row3Values.length; i++) {
    if (String(row3Values[i]).trim() === String(trackingNumber).trim()) {
      targetCol = FIXED_COLS + 1 + i;
      break;
    }
  }
  if (targetCol === -1) {
    return { success: false, message: "追跡番号「" + trackingNumber + "」が見つかりません" };
  }

  // その列全体をクリア（2行目以降）
  sheet.getRange(2, targetCol, lastRow - 1, 1).clearContent();

  return { success: true, message: "追跡番号「" + trackingNumber + "」の発送記録を削除しました" };
}
