/**
 * Zaico API クライアント
 * Bearer トークン認証を使用してZaico APIと通信する
 */

const ZAICO_BASE_URL = "https://web.zaico.co.jp/api/v1";

function getZaicoToken(): string {
  const token = process.env.ZAICO_API_TOKEN;
  if (!token) {
    throw new Error("ZAICO_API_TOKEN が設定されていません。設定画面でAPIキーを確認してください。");
  }
  return token;
}

function zaicoHeaders(token?: string): Record<string, string> {
  const t = token ?? getZaicoToken();
  return {
    Authorization: `Bearer ${t}`,
    "Content-Type": "application/json",
  };
}

async function zaicoFetch<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const url = `${ZAICO_BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      ...zaicoHeaders(token),
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    let message = `Zaico API エラー: ${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.message) message = `Zaico API エラー: ${body.message}`;
    } catch {}
    throw new Error(message);
  }

  // 204 No Content などのケース
  const text = await res.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

// ============================================================
// 型定義
// ============================================================

export interface ZaicoPurchaseItem {
  id: number;
  inventory_id: number;
  title: string;
  quantity: string;
  box_quantity?: string;
  unit: string;
  box_unit?: string;
  unit_price: string;
  status: "not_ordered" | "ordered" | "purchased";
  purchase_date: string | null;
  estimated_purchase_date: string | null;
  etc?: string;
}

export interface ZaicoPurchase {
  id: number;
  num: string;
  customer_name: string;
  status: "none" | "not_ordered" | "ordered" | "purchased" | "quotation_requested";
  total_amount: number;
  purchase_date: string | null;
  estimated_purchase_date: string | null;
  create_user_name: string;
  memo?: string;
  etc?: string;
  created_at: string;
  updated_at: string;
  purchase_items: ZaicoPurchaseItem[];
}

export interface ZaicoInventory {
  id: number;
  title: string;
  quantity: string;
  logical_quantity?: string;
  unit: string;
  category?: string;
  categories?: string[];
  place?: string;
  etc?: string;
  code?: string;
  unit_price?: number;
  purchase_unit_price?: number;
  optional_attributes?: Array<{ name: string; value: string | null }>;
  item_image?: { url: string | null };
  created_at: string;
  updated_at: string;
  /** Zaico API が返す最終入庫日（YYYY-MM-DD 形式） */
  last_purchase_date?: string | null;
}

export interface ZaicoDeliveryItem {
  inventory_id: number;
  quantity: number;
  unit_price?: number;
  etc?: string;
}

export interface ZaicoCreateDeliveryPayload {
  num?: string;
  customer_name?: string;
  status: "before_delivery" | "during_delivery" | "completed_delivery";
  delivery_date?: string;
  memo?: string;
  deliveries: ZaicoDeliveryItem[];
}

// ============================================================
// API 関数
// ============================================================

/**
 * 接続テスト：在庫一覧を1件だけ取得して認証確認
 */
export async function testConnection(token: string): Promise<{ success: boolean; message: string }> {
  try {
    await zaicoFetch<ZaicoInventory[]>("/inventories?page=1", {}, token);
    return { success: true, message: "接続に成功しました" };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "不明なエラー";
    return { success: false, message };
  }
}

/**
 * 入庫データ一覧取得（ordered / not_ordered ステータスのみ）
 * statusフィルターを使って必要なデータのみ取得
 */
export async function getPurchases(token?: string): Promise<ZaicoPurchase[]> {
  const results: ZaicoPurchase[] = [];

  // orderedとnot_orderedをそれぞれ取得
  for (const status of ["ordered", "not_ordered"]) {
    let page = 1;
    while (page <= 10) {
      const data = await zaicoFetch<ZaicoPurchase[]>(`/purchases/?page=${page}&status=${status}`, undefined, token);
      if (!Array.isArray(data) || data.length === 0) break;
      results.push(...data);
      if (data.length < 1000) break;
      page++;
    }
  }

  // 最新順にソート
  return results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

/**
 * 全ステータスの入庫データを取得（在庫削除時の紐付け確認用）
 * ordered / not_ordered / purchased すべてを含む
 */
export async function getAllPurchases(token?: string): Promise<ZaicoPurchase[]> {
  const results: ZaicoPurchase[] = [];
  for (const status of ["ordered", "not_ordered", "purchased"]) {
    let page = 1;
    while (page <= 20) {
      const data = await zaicoFetch<ZaicoPurchase[]>(`/purchases/?page=${page}&status=${status}`, undefined, token);
      if (!Array.isArray(data) || data.length === 0) break;
      results.push(...data);
      if (data.length < 1000) break;
      page++;
    }
  }
  return results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

/**
 * 入庫処理：purchase_itemsの各アイテムのstatusをpurchasedに更新
 * Zaico APIの仕様上、入庫データ全体のステータスではなく、
 * purchase_items配列の各アイテムのstatusをpurchasedに変更することで
 * 在庫数が増加する
 */
export async function completePurchase(
  purchaseId: number,
  purchaseDate: string,
  purchaseItems: Array<{ inventory_id: number; quantity: string; unit_price: string }>,
  operatorToken?: string
): Promise<{ code: number; status: string; message: string }> {
  return zaicoFetch(`/purchases/${purchaseId}`, {
    method: "PUT",
    body: JSON.stringify({
      purchase_items: purchaseItems.map((item) => ({
        inventory_id: item.inventory_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        status: "purchased",
        purchase_date: purchaseDate,
      })),
    }),
  }, operatorToken);
}

/**
 * 入庫取り消し：purchase_itemsの各アイテムのstatuseをorderedに戻す
 */
export async function revertPurchase(
  purchaseId: number,
  purchaseItems: Array<{ inventory_id: number; quantity: string; unit_price: string }>
): Promise<{ code: number; status: string; message: string }> {
  return zaicoFetch(`/purchases/${purchaseId}`, {
    method: "PUT",
    body: JSON.stringify({
      purchase_items: purchaseItems.map((item) => ({
        inventory_id: item.inventory_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        status: "ordered",
      })),
    }),
  });
}

/**
 * 入庫データ単件取得
 */
export async function getPurchaseById(purchaseId: number, token?: string): Promise<ZaicoPurchase | null> {
  try {
    return await zaicoFetch<ZaicoPurchase>(`/purchases/${purchaseId}`, {}, token);
  } catch {
    return null;
  }
}

/**
 * 在庫データ一覧取得（最大5ページ）
 */
export async function getInventories(maxPages = 5): Promise<ZaicoInventory[]> {
  const allInventories: ZaicoInventory[] = [];
  let page = 1;

  while (page <= maxPages) {
    const data = await zaicoFetch<ZaicoInventory[]>(`/inventories?page=${page}`);
    if (!Array.isArray(data) || data.length === 0) break;
    // optional_attributesから「仕入単価」を抽出してunit_priceに設定
    for (const item of data) {
      if (item.optional_attributes) {
        const priceAttr = item.optional_attributes.find((a) => a.name === "仕入単価");
        if (priceAttr?.value) {
          const parsed = parseFloat(priceAttr.value);
          if (!isNaN(parsed)) item.unit_price = parsed;
        }
      }
    }
    allInventories.push(...data);
    if (data.length < 1000) break;
    page++;
  }

  return allInventories;
}

/**
 * 在庫詳細取得（単件）
 */
export async function getInventory(inventoryId: number): Promise<ZaicoInventory> {
  return zaicoFetch<ZaicoInventory>(`/inventories/${inventoryId}`);
}

/**
 * 在庫削除
 */
export async function deleteInventory(
  inventoryId: number,
  token?: string
): Promise<{ code: number; status: string; message: string }> {
  return zaicoFetch(`/inventories/${inventoryId}`, {
    method: "DELETE",
  }, token);
}

/**
 * 入庫データを削除する（入庫取り消し）
 * 入庫済みの場合、Zaico側で自動的に在庫数が入庫数量分だけ減算される
 */
export async function deletePurchase(
  purchaseId: number,
  token?: string
): Promise<{ code: number; status: string; message: string }> {
  return zaicoFetch(`/purchases/${purchaseId}`, {
    method: "DELETE",
  }, token);
}

/**
 * 入庫済みデータから inventory_id ごとの最新入庫日を取得
 * purchased ステータスの入庫データを全ページ取得し、
 * inventory_id をキーに最新の purchase_date をマッピングして返す
 */
export async function getLatestPurchaseDateMap(): Promise<Record<number, string>> {
  const map: Record<number, string> = {};
  // 全ページを取得して全入庫履歴から最新入庫日を集計する
  let page = 1;
  while (page <= 20) {
    const data = await zaicoFetch<ZaicoPurchase[]>(`/purchases?status=purchased&page=${page}`);
    if (!Array.isArray(data) || data.length === 0) break;

    for (const purchase of data) {
      for (const item of purchase.purchase_items) {
        const id = item.inventory_id;
        const date = item.purchase_date;
        if (!date) continue;
        // より新しい日付で上書き
        if (!map[id] || date > map[id]) {
          map[id] = date;
        }
      }
    }

    if (data.length < 1000) break;
    page++;
  }
  return map;
}

/**
 * 出庫データのnum（出庫No）を更新
 */
export async function updateDeliveryNum(
  deliveryId: number,
  num: string
): Promise<{ code: number; status: string; message: string }> {
  return zaicoFetch(`/packing_slips/${deliveryId}`, {
    method: "PUT",
    body: JSON.stringify({ num }),
  });
}

/**
 * 出庫データ作成（まとめて出庫）
 */
export async function createDelivery(
  payload: ZaicoCreateDeliveryPayload
): Promise<{ code: number; status: string; message: string; data_id: number }> {
  return zaicoFetch("/packing_slips/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ============================================================
// 在庫データ 作成・更新
// ============================================================

export interface ZaicoInventoryPayload {
  title: string;
  quantity?: string;
  unit?: string;
  category?: string;
  place?: string;
  etc?: string;
  code?: string;
  purchase_unit_price?: number;
  optional_attributes?: Array<{ name: string; value: string | null }>;
}

/** 在庫ペイロードに仕入単価をoptional_attributesに変換して追加する */
function injectPurchaseUnitPrice(payload: ZaicoInventoryPayload): ZaicoInventoryPayload {
  if (payload.purchase_unit_price == null) return payload;
  const existing = payload.optional_attributes ?? [];
  const filtered = existing.filter((a) => a.name !== "仕入単価");
  return {
    ...payload,
    optional_attributes: [
      ...filtered,
      { name: "仕入単価", value: String(payload.purchase_unit_price) },
    ],
  };
}

/**
 * 在庫データ新規作成
 * POST /api/v1/inventories
 */
export async function createInventory(
  payload: ZaicoInventoryPayload,
  token?: string
): Promise<{ code: number; status: string; message: string; data_id: number }> {
  const finalPayload = injectPurchaseUnitPrice(payload);
  return zaicoFetch("/inventories", {
    method: "POST",
    body: JSON.stringify(finalPayload),
  }, token);
}

/**
 * 在庫データ更新
 * PUT /api/v1/inventories/{id}
 */
export async function updateInventory(
  inventoryId: number,
  payload: ZaicoInventoryPayload,
  token?: string
): Promise<{ code: number; status: string; message: string }> {
  const finalPayload = injectPurchaseUnitPrice(payload);
  return zaicoFetch(`/inventories/${inventoryId}`, {
    method: "PUT",
    body: JSON.stringify(finalPayload),
  }, token);
}

// ============================================================
// 入庫データ（発注済み）作成
// ============================================================

export interface ZaicoCreatePurchasePayload {
  num?: string;
  customer_name?: string;
  status: "none" | "not_ordered" | "ordered" | "purchased" | "quotation_requested";
  purchase_date?: string;
  estimated_purchase_date?: string;
  memo?: string;
  etc?: string;
  purchase_items: Array<{
    inventory_id: number;
    quantity: number;
    unit_price?: number;
    estimated_purchase_date?: string;
    etc?: string;
  }>;
}

/**
 * 入庫データ（発注済み）新規作成
 * POST /api/v1/purchases/
 */
export async function createPurchase(
  payload: ZaicoCreatePurchasePayload,
  token?: string
): Promise<{ code: number; status: string; message: string; data_id: number }> {
  return zaicoFetch("/purchases/", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

/**
 * 全入庫データのnumを取得して最大値を返す
 * 発注No自動採番用（最大値+1を次の発注Noとして使用）
 * Linkヘッダーで次ページの有無を判定して全ページを取得する
 */
export async function getMaxPurchaseNum(token?: string): Promise<number> {
  const t = token ?? getZaicoToken();
  let maxNum = 0;
  for (const status of ["ordered", "not_ordered", "purchased"]) {
    let page = 1;
    while (page <= 50) {
      const url = `${ZAICO_BASE_URL}/purchases/?page=${page}&status=${status}`;
      const res = await fetch(url, { headers: zaicoHeaders(t) });
      if (!res.ok) break;
      const text = await res.text();
      if (!text) break;
      const data = JSON.parse(text) as ZaicoPurchase[];
      if (!Array.isArray(data) || data.length === 0) break;
      for (const p of data) {
        const n = parseInt(p.num, 10);
        if (!Number.isNaN(n) && n > maxNum) maxNum = n;
      }
      // Linkヘッダーに"next"がなければ最後のページ
      const linkHeader = res.headers.get("Link") ?? "";
      if (!linkHeader.includes('rel="next"')) break;
      page++;
    }
  }
  return maxNum;
}

/**
 * 出庫データ削除（出庫取り消し）
 * DELETE /api/v1/packing_slips/{id}
 * 出庫済みの場合、在庫数量を出庫数量分だけ自動で戻す
 */
export async function deleteDelivery(
  deliveryId: number,
  token?: string
): Promise<{ code: number; status: string; message: string }> {
  return zaicoFetch(`/packing_slips/${deliveryId}`, {
    method: "DELETE",
  }, token);
}

/**
 * 出庫データ個別取得
 * GET /api/v1/packing_slips/{id}
 */
export async function getDelivery(
  deliveryId: number,
  token?: string
): Promise<{ id: number; num: string; status: string; packing_slip_items?: Array<{ id: number; inventory_id: number; quantity: string; title: string }> } | null> {
  try {
    return await zaicoFetch(`/packing_slips/${deliveryId}`, {}, token);
  } catch {
    return null;
  }
}

/**
 * 発注データ更新（単価・管理番号・入庫予定日等）
 * PUT /api/v1/purchases/{id}
 */
export interface ZaicoUpdatePurchasePayload {
  customer_name?: string;
  status?: "none" | "not_ordered" | "ordered" | "purchased" | "quotation_requested";
  estimated_purchase_date?: string;
  memo?: string;
  etc?: string;
  purchase_items?: Array<{
    id: number;
    inventory_id: number;
    quantity?: number;
    unit_price?: number;
    estimated_purchase_date?: string;
    etc?: string;
  }>;
}
export async function updatePurchase(
  purchaseId: number,
  payload: ZaicoUpdatePurchasePayload,
  token?: string
): Promise<{ code: number; status: string; message: string }> {
  return zaicoFetch(`/purchases/${purchaseId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }, token);
}
