/**
 * ============================================================
 * Zaico 在庫登録 + GitHub CSV 自動同期 GAS スクリプト（統合版）
 * ============================================================
 *
 * 【使い方】
 * 1. Google スプレッドシートを開く
 * 2. 拡張機能 → Apps Script を開く
 * 3. このコードを貼り付けて保存
 * 4. setupTrigger() を実行してトリガーを設定する
 *
 * 【スプレッドシートの列構成（1-indexed）】
 * A列( 1): チェックボックス（TRUE=Zaico登録対象）
 * B列( 2): 在庫用商品名（Zaicoに登録する商品名）
 * C列( 3): SRN管理番号（インボイスNo）
 * F列( 6): 備考欄2行目（支払日など）
 * G列( 7): 仕入先名または古物番号
 * I列( 9): 仕入先URL（取引URL）
 * J列(10): 発注数量
 * K列(11): 仕入単価（合計金額）
 * N列(14): 仕入先詳細名（「駿河屋 なんば店」「ペイペイフリマ 星川みつき」等）
 *
 * 【Zaico備考欄のフォーマット】
 * C列の値, F列の値, G列の値（仕入先名）
 *
 * 【GitHub CSV 自動同期について】
 * - セルを編集するたびに自動でGitHubのCSVファイルを更新します
 * - GITHUB_TOKEN にリポジトリへの書き込み権限が必要です
 * ============================================================
 */

// ============================================================
// 設定（必ず確認してください）
// ============================================================

/** Webhook URL */
const DEFAULT_WEBHOOK_URL = "https://your-app.example.com/api/gas-webhook/register-product";

/** シークレットキー（GAS_WEBHOOK_SECRET の値） */
const DEFAULT_WEBHOOK_SECRET = "";

function getWebhookUrl() {
  const raw = PropertiesService.getScriptProperties().getProperty("GAS_WEBHOOK_URL") || DEFAULT_WEBHOOK_URL;
  return raw
    .toString()
    .trim()
    .replace(/^GAS_WEBHOOK_URL\s*=\s*/i, "")
    .replace(/^['"]|['"]$/g, "");
}

function getWebhookSecret() {
  return PropertiesService.getScriptProperties().getProperty("GAS_WEBHOOK_SECRET") || DEFAULT_WEBHOOK_SECRET;
}

/**
 * 登録種別:
 * "inventory" = 在庫のみ登録
 * "both"      = 在庫 + 発注済みデータを登録
 */
const REGISTER_TYPE = "both";

/** データ開始行（ヘッダー行の次の行番号）*/
const DATA_START_ROW = 4;

/** シートのタブ名（空文字の場合はアクティブシートを使用）*/
const SHEET_NAME = "";

// ============================================================
// GitHub CSV 同期設定
// ============================================================

/**
 * GitHub Personal Access Token（repo権限が必要）
 * ここに直接貼り付けるか、スクリプトプロパティ「GITHUB_TOKEN」に設定してください
 * スクリプトプロパティの設定方法: Apps Script エディタ → プロジェクトの設定 → スクリプトプロパティ
 */
const GITHUB_TOKEN = "";  // ← ここに貼り付けるか、スクリプトプロパティ「GITHUB_TOKEN」に設定

/** GitHubオーナー名 */
const GITHUB_OWNER = "07-hajime-tokyo";

/** GitHubリポジトリ名 */
const GITHUB_REPO = "merukanri-data-site";

/** CSVファイルのパス */
const GITHUB_FILE_PATH = "data.csv";

// ============================================================
// 列番号定数（1始まり）
// ============================================================
const COL_CHECKBOX         = 1;   // A列: チェックボックス
const COL_PRODUCT_NAME     = 2;   // B列: 在庫用商品名
const COL_SRN              = 3;   // C列: SRN管理番号
const COL_F                = 6;   // F列: 備考欄2行目
const COL_SUPPLIER         = 7;   // G列: 仕入先名または古物番号
const COL_SUPPLIER_URL     = 9;   // I列: 仕入先URL
const COL_QUANTITY         = 10;  // J列: 数量
const COL_PRICE            = 11;  // K列: 仕入単価
const COL_SUPPLIER_DETAIL  = 14;  // N列: 仕入先詳細名

// ============================================================
// 商品名からカテゴリーを自動判別するマッピング
// ============================================================
function getCategoryFromProductName(productName) {
  if (!productName) return "";
  if (/switch\s*lite|スイッチ\s*ライト|switchlite/i.test(productName)) return "スイッチライト";
  if (/switch|スイッチ/i.test(productName)) return "スイッチ";
  if (/vita\s*2000|vita2000|pch-2/i.test(productName)) return "Vita2000";
  if (/vita\s*1000|vita1000|pch-1/i.test(productName)) return "Vita1000";
  if (/new\s*3ds\s*ll|new3dsll|new\s*3ds\s*xl/i.test(productName)) return "New3DSLL";
  if (/new\s*3ds(?!\s*ll|\s*xl)/i.test(productName)) return "New3DS";
  if (/new\s*2ds\s*ll|new2dsll/i.test(productName)) return "New2DSLL";
  if (/3ds\s*ll|3dsll|3ds\s*xl/i.test(productName)) return "3DSLL";
  if (/3ds(?!\s*ll|\s*xl)/i.test(productName)) return "3DS";
  if (/ds\s*lite|dslite/i.test(productName)) return "DS lite";
  if (/dsi\s*ll|dsi\s*xl/i.test(productName)) return "DSi LL";
  if (/dsi(?!\s*ll|\s*xl)/i.test(productName)) return "DSi";
  if (/psp/i.test(productName)) return "PSP";
  return "ゲーム";
}

// ============================================================
// URLから仕入先名を特定するマッピング
// ============================================================
const SUPPLIER_URL_MAP = [
  { pattern: /mercari\.com/i,              name: "メルカリ" },
  { pattern: /mercari\.jp/i,               name: "メルカリ" },
  { pattern: /paypay.*flea|flea.*paypay|paypayfleamarket|paypay-flea-market/i, name: "ペイペイフリマ" },
  { pattern: /yahoo\.co\.jp.*auctions|auctions\.yahoo|aucfan\.com/i, name: "ヤフオク" },
  { pattern: /surugaya\.co\.jp|suruga-ya\.jp/i, name: "駿河屋" },
  { pattern: /amazon\.co\.jp|amazon\.com/i, name: "アマゾン" },
  { pattern: /rakuten\.co\.jp/i,            name: "楽天" },
  { pattern: /bookoff\.co\.jp/i,            name: "ブックオフ" },
  { pattern: /hardoff\.co\.jp/i,            name: "ハードオフ" },
  { pattern: /netoff\.co\.jp/i,             name: "ネットオフ" },
  { pattern: /2ndstreet\.jp/i,              name: "セカンドストリート" },
  { pattern: /geo\.ne\.jp/i,                name: "ゲオ" },
  { pattern: /janpara\.co\.jp/i,            name: "じゃんぱら" },
  { pattern: /sofmap\.com/i,                name: "ソフマップ" },
  { pattern: /yodobashi\.com/i,             name: "ヨドバシカメラ" },
  { pattern: /bic\.camera/i,                name: "ビックカメラ" },
  { pattern: /joshin\.co\.jp/i,             name: "ジョーシン" },
  { pattern: /kojima\.net/i,                name: "コジマ" },
  { pattern: /nojima\.co\.jp/i,             name: "ノジマ" },
  { pattern: /yahoo\.co\.jp\/shopping|shopping\.yahoo/i, name: "Yahoo!ショッピング" },
  { pattern: /qoo10\.jp/i,                  name: "Qoo10" },
  { pattern: /ebay\.com/i,                  name: "eBay" },
  { pattern: /aliexpress\.com/i,            name: "AliExpress" },
  { pattern: /buyee\.jp/i,                  name: "Buyee" },
  { pattern: /fril\.jp/i,                   name: "フリル" },
  { pattern: /mbok\.jp/i,                   name: "モバオク" },
  { pattern: /jmty\.jp/i,                   name: "ジモティー" },
];

function getSupplierNameFromUrl(url) {
  if (!url || url.trim() === "") return "";
  const trimmed = url.trim();
  for (const entry of SUPPLIER_URL_MAP) {
    if (entry.pattern.test(trimmed)) return entry.name;
  }
  try {
    const match = trimmed.match(/^https?:\/\/(?:www\.)?([^\/\?#]+)/i);
    if (match) return match[1];
  } catch (_) {}
  return trimmed;
}

function isKobutsuNumber(value) {
  if (!value) return false;
  return /^[\d\-\s]{6,}$/.test(value.trim());
}

// ============================================================
// トリガー関数（編集時に自動実行）
// ============================================================

/**
 * セルが編集されたときに呼び出されるメインのトリガー関数
 * - A列のチェックボックスがONになった場合 → Zaico登録処理
 * - その他の編集 → GitHub CSV自動同期
 */
function onCheckboxChange(e) {
  try {
    const sheet = getTargetSheet();
    const range = e.range;
    const row = range.getRow();
    const col = range.getColumn();

    // ヘッダー行より上は無視
    if (row < DATA_START_ROW) return;

    // A列（チェックボックス列）がONになった場合 → Zaico登録
    if (col === COL_CHECKBOX) {
      const value = range.getValue();
      if (value === true) {
        handleZaicoRegistration(sheet, range, row);
      }
    }

    // 全編集時 → GitHub CSV同期（チェックボックスON/OFFも含む）
    syncToGithub();

  } catch (err) {
    Logger.log("onCheckboxChange エラー: " + err.toString());
  }
}

// ============================================================
// Zaico 登録処理
// ============================================================

/**
 * A列チェックボックスがONになった行をZaicoに登録する
 */
function handleZaicoRegistration(sheet, checkboxRange, row) {
  // 行データをN列（14列目）まで取得
  const rowData = sheet.getRange(row, 1, 1, COL_SUPPLIER_DETAIL).getValues()[0];
  const productName      = String(rowData[COL_PRODUCT_NAME - 1] ?? "").trim();
  const srnNumber        = String(rowData[COL_SRN - 1] ?? "").trim();
  const colFRaw          = rowData[COL_F - 1];
  const colFValue        = colFRaw instanceof Date
    ? Utilities.formatDate(colFRaw, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss")
    : String(colFRaw ?? "").trim();
  const colGValue        = String(rowData[COL_SUPPLIER - 1] ?? "").trim();
  const supplierUrl      = String(rowData[COL_SUPPLIER_URL - 1] ?? "").trim();
  const quantityRaw      = rowData[COL_QUANTITY - 1];
  const priceRaw         = rowData[COL_PRICE - 1];
  const supplierDetail   = String(rowData[COL_SUPPLIER_DETAIL - 1] ?? "").trim();

  // 商品名が空の場合はスキップ
  if (!productName) {
    SpreadsheetApp.getUi().alert("⚠️ エラー", `${row}行目: 在庫用商品名（B列）が空です。`, SpreadsheetApp.getUi().ButtonSet.OK);
    checkboxRange.setValue(false);
    return;
  }

  const inventoryQuantity = 0;  // 在庫数量は常に0
  const orderQuantity = quantityRaw ? parseInt(quantityRaw, 10) || 1 : 1;
  const totalPrice = priceRaw ? parseFloat(priceRaw) || undefined : undefined;
  // 数量が2以上の場合は合計金額÷数量で単価を算出（四捨五入）
  const purchasePrice = (totalPrice != null && orderQuantity >= 2)
    ? Math.round(totalPrice / orderQuantity)
    : totalPrice;

  // 仕入先名を決定
  let supplierName = "";
  if (colGValue && !isKobutsuNumber(colGValue)) {
    // 駿河屋・Amazonはそれぞれ特別処理、それ以外はG列+N列（出品者名）を組み合わせる
    if (/^駿河屋/i.test(colGValue) && supplierDetail) {
      // 駿河屋: N列（店舗名）のみ
      supplierName = supplierDetail;
    } else if (/^Amazon$/i.test(colGValue)) {
      // Amazon: N列のみ（G列の「Amazon」は使わない）
      supplierName = supplierDetail || colGValue;
    } else if (supplierDetail) {
      supplierName = `${colGValue} ${supplierDetail}`;
    } else {
      supplierName = colGValue;
    }
  } else if (supplierUrl) {
    // URLから仕入先名を取得し、アマゾンの場合はN列の出品者名も組み合わせる
    const urlSupplierName = getSupplierNameFromUrl(supplierUrl);
    if (/^アマゾン$/i.test(urlSupplierName) && supplierDetail) {
      supplierName = `${urlSupplierName} ${supplierDetail}`;
    } else {
      supplierName = urlSupplierName;
    }
  }

  // 備考欄を構築: C列, F列, G列（仕入先名）
  const etcLines = [];
  if (srnNumber) etcLines.push(srnNumber);
  if (colFValue) etcLines.push(colFValue);
  if (supplierName) etcLines.push(supplierName);
  const etcText = etcLines.join(", ");

  // 商品名からカテゴリーを自動判別
  const autoCategory = getCategoryFromProductName(productName);

  // 確認ダイアログを表示
  const ui = SpreadsheetApp.getUi();
  const confirmMessage = buildConfirmMessage(
    productName, srnNumber, supplierName, supplierDetail, supplierUrl,
    inventoryQuantity, orderQuantity, purchasePrice, row, etcText, autoCategory
  );
  const response = ui.alert("📦 在庫登録確認", confirmMessage, ui.ButtonSet.YES_NO);

  if (response !== ui.Button.YES) {
    checkboxRange.setValue(false);
    return;
  }

  // F列の購入日をYYYY-MM-DD形式に変換
  const purchaseDateStr = colFRaw instanceof Date
    ? Utilities.formatDate(colFRaw, Session.getScriptTimeZone(), "yyyy-MM-dd")
    : (colFValue ? colFValue.slice(0, 10) : "");

  // Webhookを呼び出して在庫登録
  const result = callWebhook({
    productName,
    srnNumber: srnNumber || undefined,
    supplier: supplierName || undefined,
    supplierUrl: supplierUrl || undefined,
    supplierDetail: supplierDetail || undefined,
    etcText: etcText || undefined,
    quantity: inventoryQuantity,
    orderQuantity: orderQuantity,
    purchasePrice,
    category: autoCategory || undefined,
    purchaseDate: purchaseDateStr || undefined,
    rowIndex: row,
  });

  if (result.success) {
    const successMsg = buildSuccessMessage(result, productName);
    ui.alert("✅ 登録完了", successMsg, ui.ButtonSet.OK);
    // 登録済みの印として行の背景色を変える
    sheet.getRange(row, 1, 1, COL_PRICE).setBackground("#e8f5e9");
  } else {
    checkboxRange.setValue(false);
    ui.alert("❌ 登録失敗", `エラー: ${result.error || "不明なエラー"}`, ui.ButtonSet.OK);
  }
}

// ============================================================
// GitHub CSV 自動同期
// ============================================================

/**
 * スプレッドシートの全データをGitHubのCSVファイルに同期する
 * onCheckboxChange から自動で呼ばれるほか、手動でも実行できる
 */
function syncToGithub() {
  // GITHUB_TOKEN の取得（定数 → スクリプトプロパティの順で参照）
  const token = GITHUB_TOKEN || PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN") || "";
  if (!token) {
    Logger.log("syncToGithub: GITHUB_TOKEN が未設定のためスキップ");
    return;
  }

  const sheet = getTargetSheet();
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 1) return;

  // シート全データ取得
  const allData = sheet.getRange(1, 1, lastRow, lastCol).getValues();

  // CSVテキスト生成
  const now = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  const csvLines = [];
  csvLines.push("");                          // 行0: 空行
  csvLines.push("更新日時," + now);           // 行1: 更新日時
  csvLines.push(allData[0].map(escapeCSV).join(",")); // 行2: ヘッダー（スプシ1行目）

  // DATA_START_ROW-1 からのデータ行
  for (let i = DATA_START_ROW - 1; i < allData.length; i++) {
    const row = allData[i];
    if (row.every(cell => cell === "" || cell === null || cell === undefined)) continue;
    csvLines.push(row.map(escapeCSV).join(","));
  }

  const csvContent = csvLines.join("\n");

  // GitHub APIでファイルを更新
  const apiUrl = "https://api.github.com/repos/" + GITHUB_OWNER + "/" + GITHUB_REPO + "/contents/" + GITHUB_FILE_PATH;

  // 現在のファイルのSHAを取得（更新に必要）
  let currentSha = "";
  try {
    const getRes = UrlFetchApp.fetch(apiUrl, {
      method: "get",
      headers: {
        "Authorization": "token " + token,
        "Accept": "application/vnd.github.v3+json",
      },
      muteHttpExceptions: true,
    });
    if (getRes.getResponseCode() === 200) {
      currentSha = JSON.parse(getRes.getContentText()).sha || "";
    }
  } catch (e) {
    Logger.log("GitHub SHA取得エラー（新規作成として続行）: " + e.message);
  }

  // ファイルを更新（または新規作成）
  const body = {
    message: "スプレッドシートから自動更新 " + now,
    content: Utilities.base64Encode(csvContent, Utilities.Charset.UTF_8),
    branch: "main",
  };
  if (currentSha) body.sha = currentSha;

  try {
    const putRes = UrlFetchApp.fetch(apiUrl, {
      method: "put",
      headers: {
        "Authorization": "token " + token,
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      payload: JSON.stringify(body),
      muteHttpExceptions: true,
    });
    const putCode = putRes.getResponseCode();
    if (putCode === 200 || putCode === 201) {
      Logger.log("GitHub CSV更新成功 (" + putCode + ")");
    } else {
      Logger.log("GitHub CSV更新失敗 (" + putCode + "): " + putRes.getContentText().slice(0, 200));
    }
  } catch (e) {
    Logger.log("GitHub CSV更新エラー: " + e.message);
  }
}

// ============================================================
// 仕入先詳細名（N列）の一括再同期
// ============================================================

/**
 * 既存の登録済み行のN列（仕入先詳細名）をサイトに一括反映する
 * タイムアウト対策として100行ずつ処理し、続きから再開できます。
 *
 * 【使い方】
 * 1. Apps Script エディタでこの関数を選択
 * 2. 「実行」ボタンをクリック
 * 3. 「続きがあります」と表示されたら再度「実行」を繰り返す
 * 4. 「完了」ダイアログが出たら全件処理済み
 *
 * ※ 途中でリセットしたい場合は bulkResyncReset() を実行してください
 */
function bulkResyncSupplierDetail() {
  const ui = SpreadsheetApp.getUi();
  const sheet = getTargetSheet();
  const lastRow = sheet.getLastRow();
  const props = PropertiesService.getScriptProperties();

  if (lastRow < DATA_START_ROW) {
    ui.alert("⚠️ データなし", "対象行が見つかりませんでした。", ui.ButtonSet.OK);
    return;
  }

  // 進捗を取得（初回は DATA_START_ROW から開始）
  const startRow = parseInt(props.getProperty("RESYNC_NEXT_ROW") || String(DATA_START_ROW), 10);
  const totalUpdatedSoFar  = parseInt(props.getProperty("RESYNC_TOTAL_UPDATED")   || "0", 10);
  const totalSkippedSoFar  = parseInt(props.getProperty("RESYNC_TOTAL_SKIPPED")   || "0", 10);
  const totalNotFoundSoFar = parseInt(props.getProperty("RESYNC_TOTAL_NOT_FOUND") || "0", 10);

  // 初回実行時のみ確認ダイアログを表示
  if (startRow === DATA_START_ROW) {
    const totalRows = lastRow - DATA_START_ROW + 1;
    const confirm = ui.alert(
      "📦 一括反映確認",
      `登録済み行（最大 ${totalRows} 行）の仕入先詳細名をサイトに反映します。\n` +
      `件数が多い場合は複数回「実行」を押す必要があります。\n\nよろしいですか？`,
      ui.ButtonSet.YES_NO
    );
    if (confirm !== ui.Button.YES) return;
  }

  // 1回の実行で処理する行数（タイムアウト対策）
  const ROWS_PER_RUN = 100;
  const endRow = Math.min(startRow + ROWS_PER_RUN - 1, lastRow);
  const numRows = endRow - startRow + 1;

  // 対象範囲のデータを取得
  const rangeData = sheet.getRange(startRow, 1, numRows, COL_SUPPLIER_DETAIL).getValues();
  const items = [];

  for (let i = 0; i < rangeData.length; i++) {
    const rowData = rangeData[i];
    const rowIndex = startRow + i;
    const checkbox = rowData[COL_CHECKBOX - 1];
    const productName    = String(rowData[COL_PRODUCT_NAME - 1] ?? "").trim();
    const colGValue      = String(rowData[COL_SUPPLIER - 1] ?? "").trim();
    const supplierUrl    = String(rowData[COL_SUPPLIER_URL - 1] ?? "").trim();
    const supplierDetail = String(rowData[COL_SUPPLIER_DETAIL - 1] ?? "").trim();

    if (checkbox !== true || !productName) continue;
    if (!supplierDetail && !colGValue && !supplierUrl) continue;

    let supplierName = "";
    if (colGValue && !isKobutsuNumber(colGValue)) {
      supplierName = colGValue;
    } else if (supplierUrl) {
      supplierName = getSupplierNameFromUrl(supplierUrl);
    }

    items.push({
      productName,
      supplierDetail: supplierDetail || undefined,
      supplier: supplierName || undefined,
      supplierUrl: supplierUrl || undefined,
      rowIndex,
    });
  }

  // サーバーに送信
  let updated = 0, skipped = 0, notFound = 0;
  if (items.length > 0) {
    try {
      const response = UrlFetchApp.fetch(
        getWebhookUrl().replace("/register-product", "/update-supplier"),
        {
          method: "post",
          contentType: "application/json",
          payload: JSON.stringify({ secret: getWebhookSecret(), items }),
          muteHttpExceptions: true,
        }
      );
      const result = JSON.parse(response.getContentText());
      if (result.success) {
        updated  = result.updated  || 0;
        skipped  = result.skipped  || 0;
        notFound = result.notFound || 0;
      } else {
        Logger.log("送信エラー: " + result.error);
      }
    } catch (err) {
      Logger.log("例外: " + err);
    }
  }

  const newTotalUpdated  = totalUpdatedSoFar  + updated;
  const newTotalSkipped  = totalSkippedSoFar  + skipped;
  const newTotalNotFound = totalNotFoundSoFar + notFound;

  if (endRow < lastRow) {
    // まだ続きがある → 進捗を保存して次回へ
    props.setProperty("RESYNC_NEXT_ROW",        String(endRow + 1));
    props.setProperty("RESYNC_TOTAL_UPDATED",   String(newTotalUpdated));
    props.setProperty("RESYNC_TOTAL_SKIPPED",   String(newTotalSkipped));
    props.setProperty("RESYNC_TOTAL_NOT_FOUND", String(newTotalNotFound));
    ui.alert(
      "⏳ 続きがあります",
      `${startRow}〜${endRow} 行を処理しました（残り: ${lastRow - endRow} 行）。\n\n` +
      `累計 ✅ 更新: ${newTotalUpdated} 件 / ❓ 未発見: ${newTotalNotFound} 件\n\n` +
      `「OK」を押した後、再度 bulkResyncSupplierDetail を実行してください。`,
      ui.ButtonSet.OK
    );
  } else {
    // 全件処理完了 → 進捗をリセット
    props.deleteProperty("RESYNC_NEXT_ROW");
    props.deleteProperty("RESYNC_TOTAL_UPDATED");
    props.deleteProperty("RESYNC_TOTAL_SKIPPED");
    props.deleteProperty("RESYNC_TOTAL_NOT_FOUND");
    ui.alert(
      "✅ 一括反映完了",
      `全件の処理が完了しました。\n\n` +
      `✅ 更新: ${newTotalUpdated} 件\n` +
      `⏭️ スキップ（仕入先情報なし）: ${newTotalSkipped} 件\n` +
      `❓ 未発見（商品名不一致）: ${newTotalNotFound} 件\n\n` +
      `※ 未発見の場合は商品名がスプシとZaicoで異なる可能性があります。`,
      ui.ButtonSet.OK
    );
  }
}

/**
 * 一括反映の進捗をリセットする（最初からやり直す場合に使用）
 */
function bulkResyncReset() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty("RESYNC_NEXT_ROW");
  props.deleteProperty("RESYNC_TOTAL_UPDATED");
  props.deleteProperty("RESYNC_TOTAL_SKIPPED");
  props.deleteProperty("RESYNC_TOTAL_NOT_FOUND");
  SpreadsheetApp.getUi().alert("✅ リセット完了", "進捗をリセットしました。次回から最初から処理します。", SpreadsheetApp.getUi().ButtonSet.OK);
}

// ============================================================
// トリガーの設定（初回のみ実行）
// ============================================================

/**
 * 編集トリガーを設定する
 * 初回のみ手動で実行してください（Apps Script エディタから）
 */
function setupTrigger() {
  // 既存のトリガーを削除
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === "onCheckboxChange" ||
        trigger.getHandlerFunction() === "onOpen") {
      ScriptApp.deleteTrigger(trigger);
    }
  }

  // 編集トリガーを作成
  ScriptApp.newTrigger("onCheckboxChange")
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onEdit()
    .create();

  // onOpenトリガーを作成（カスタムメニュー用）
  ScriptApp.newTrigger("onOpen")
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onOpen()
    .create();

  SpreadsheetApp.getUi().alert(
    "✅ トリガー設定完了",
    "以下のトリガーを設定しました。\n\n" +
    "・編集トリガー（onCheckboxChange）\n" +
    "  → A列チェックボックスON: Zaico登録ダイアログ\n" +
    "  → その他の編集: GitHub CSV自動同期\n\n" +
    "・onOpenトリガー\n" +
    "  → スプレッドシートを開くと「Zaico登録」メニューが表示されます",
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

// ============================================================
// 疎通確認（テスト用）
// ============================================================

/**
 * Webhookサーバーへの疎通確認
 *
 * 【実行方法】
 * ① Apps Script エディタから直接実行 → 実行ログで結果を確認
 * ② スプレッドシートのメニュー「Zaico登録」→「接続テスト」から実行
 */
function testConnection() {
  const healthUrl = getWebhookUrl().replace("/register-product", "/health");
  try {
    const response = UrlFetchApp.fetch(healthUrl, { muteHttpExceptions: true });
    const statusCode = response.getResponseCode();
    const body = response.getContentText();
    const success = statusCode === 200;
    const message = success
      ? `✅ 接続成功\nステータス: ${statusCode}\nレスポンス: ${body}`
      : `⚠️ 接続エラー\nステータス: ${statusCode}\nレスポンス: ${body}`;
    Logger.log(message);
    try {
      const ui = SpreadsheetApp.getUi();
      ui.alert(success ? "✅ 接続成功" : "⚠️ 接続エラー", message, ui.ButtonSet.OK);
    } catch (_) {}
    return { success, statusCode, body };
  } catch (err) {
    const message = `❌ 接続失敗\nエラー: ${err.toString()}`;
    Logger.log(message);
    try {
      SpreadsheetApp.getUi().alert("❌ 接続失敗", `エラー: ${err.toString()}`, SpreadsheetApp.getUi().ButtonSet.OK);
    } catch (_) {}
    return { success: false, error: err.toString() };
  }
}

/**
 * GitHub CSV同期のテスト（手動実行用）
 */
function testSyncToGithub() {
  const token = GITHUB_TOKEN || PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN") || "";
  if (!token) {
    SpreadsheetApp.getUi().alert(
      "⚠️ エラー",
      "GITHUB_TOKEN が未設定です。\n\n" +
      "スクリプト上部の GITHUB_TOKEN に直接貼り付けるか、\n" +
      "「プロジェクトの設定」→「スクリプトプロパティ」に\n" +
      "キー: GITHUB_TOKEN\n" +
      "値: ghp_xxxx... (Personal Access Token)\n" +
      "を追加してください。",
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    return;
  }
  syncToGithub();
  SpreadsheetApp.getUi().alert(
    "✅ 同期完了",
    "GitHubへのCSV同期が完了しました。\nApps Scriptのログで結果を確認してください。",
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

// ============================================================
// カスタムメニュー（スプレッドシートを開いたときに追加）
// ============================================================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Zaico登録")
    .addItem("接続テスト", "testConnection")
    .addItem("GitHub CSV同期テスト", "testSyncToGithub")
    .addSeparator()
    .addItem("仕入先詳細名を一括反映", "bulkResyncSupplierDetail")
    .addItem("一括反映をリセット", "bulkResyncReset")
    .addSeparator()
    .addItem("トリガー設定", "setupTrigger")
    .addToUi();
}

// ============================================================
// ユーティリティ関数
// ============================================================

function getTargetSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (SHEET_NAME && SHEET_NAME.trim() !== "") {
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error(`シート「${SHEET_NAME}」が見つかりません`);
    return sheet;
  }
  return ss.getActiveSheet();
}

function buildConfirmMessage(productName, srnNumber, supplierName, supplierDetail, supplierUrl, inventoryQuantity, orderQuantity, purchasePrice, row, etcText, autoCategory) {
  let msg = `以下の内容で在庫登録します。よろしいですか？\n\n`;
  msg += `📋 行番号: ${row}\n`;
  msg += `📦 商品名: ${productName}\n`;
  if (autoCategory) msg += `🏷️ カテゴリー: ${autoCategory}（自動判別）\n`;
  if (srnNumber) msg += `🔢 SRN番号: ${srnNumber}\n`;
  if (supplierName) msg += `🏦 仕入先: ${supplierName}\n`;
  if (supplierDetail) msg += `🏪 仕入先詳細: ${supplierDetail}\n`;
  if (supplierUrl) msg += `🔗 仕入先URL: ${supplierUrl}\n`;
  msg += `📊 在庫数量: ${inventoryQuantity} 個（固定）\n`;
  msg += `📊 発注数量: ${orderQuantity} 個（J列）\n`;
  if (purchasePrice != null) msg += `💴 仕入単価: ¥${purchasePrice.toLocaleString()}\n`;
  msg += `\n📝 備考欄:\n${etcText || "（なし）"}\n`;
  msg += `\n登録種別: 在庫のみ（Zaico連携解除済み）`;
  return msg;
}

function buildSuccessMessage(result, productName) {
  let msg = `「${productName}」を在庫登録しました。\n\n`;
  if (result.results && result.results.inventory) {
    msg += `✅ 在庫ID: ${result.results.inventory.id}\n`;
  }
  return msg;
}

function callWebhook(data) {
  const payload = {
    secret: getWebhookSecret(),
    registerType: REGISTER_TYPE,
    ...data,
  };
  try {
    const response = UrlFetchApp.fetch(getWebhookUrl(), {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();
    Logger.log(`Webhook レスポンス: ${statusCode} ${responseText}`);
    return JSON.parse(responseText);
  } catch (err) {
    Logger.log("Webhook呼び出しエラー: " + err.toString());
    return { success: false, error: err.toString() };
  }
}

/**
 * CSV用にセルの値をエスケープする
 */
function escapeCSV(value) {
  const str = (value === null || value === undefined) ? "" : value.toString();
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// ============================================================
// FedEx発送登録 Webhook（doPost）
// ============================================================
/**
 * Webhook エントリーポイント
 * action: "writeShipmentBatch" → FedEx発送情報をスプシに書き込む
 *
 * リクエスト JSON 形式:
 * {
 *   "secret": "...",
 *   "action": "writeShipmentBatch",
 *   "deliveryNo": "375_luca2026036",
 *   "invoiceNo": "375",
 *   "sheetName": "独発送管理",  // or "サミー発送管理"
 *   "shippingDate": "4/8",
 *   "trackingNumber": "7489123456789",
 *   "items": [
 *     { "productNameJa": "PS Vita 2000 ランダムカラー", "productNameEn": "PS Vita 2000 Random color", "quantity": 5 }
 *   ]
 * }
 *
 * スプシ構造（独発送管理・サミー発送管理共通）:
 *   1行目: ヘッダー（インボイスNo., 支払い, 商品名日本語, 商品名英語, 発注数, shipped, [発送日1], [発送日2], ...）
 *   2行目: ラベル（invoice, Date of payment, ..., shipped, [追跡番号1], [追跡番号2], ...）
 *   3行目以降: データ行
 *
 * 書き込みロジック:
 * 1. 最後に使われている列の次の列を探す（G列以降）
 * 2. 1行目に発送日を書き込む
 * 3. 2行目に追跡番号を書き込む
 * 4. インボイスNoと商品名を照合して、各商品行に出庫数を書き込む
 */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const secret = getWebhookSecret();
    if (body.secret !== secret) {
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

/**
 * FedEx発送情報をスプシに書き込む
 *
 * @param {Object} params
 * @param {string} params.invoiceNo - インボイス番号（例: "375"）
 * @param {string} params.sheetName - シート名（"独発送管理" or "サミー発送管理"）
 * @param {string} params.shippingDate - 発送日（例: "4/8"）
 * @param {string} params.trackingNumber - FedEx追跡番号
 * @param {Array}  params.items - 商品リスト [{productNameJa, productNameEn, quantity}]
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

  // G列（7列目）以降に発送日・追跡番号が並んでいる
  // スプシ構造: 1行目=発送日, 2行目=追跡番号, 3行目以降=データ
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
  // B列（2列目）がインボイスNo、D列（4列目）が商品名日本語、E列（5列目）が商品名英語
  const COL_INVOICE_SHEET = 2;  // B列
  const COL_NAME_JA_SHEET = 4;  // D列
  const COL_NAME_EN_SHEET = 5;  // E列

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

/**
 * FedEx発送情報を更新する（追跡番号・発送日・商品数量を上書き）
 *
 * @param {Object} params
 * @param {string} params.sheetName - シート名（"独発送管理" or "サミー発送管理"）
 * @param {string} params.oldTrackingNumber - 変更前の追跡番号
 * @param {string} params.trackingNumber - 新しい追跡番号
 * @param {string} params.shippingDate - 新しい発送日
 * @param {string} params.invoiceNo - インボイス番号
 * @param {Array}  params.items - 商品リスト [{productNameJa, productNameEn, quantity}]
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

/**
 * FedEx発送記録を削除する（追跡番号の列をクリア）
 *
 * @param {Object} params
 * @param {string} params.sheetName - シート名
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
