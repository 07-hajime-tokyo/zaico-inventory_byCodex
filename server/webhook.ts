/**
 * GAS Webhook エンドポイント
 * Google Sheets の GAS から呼び出されて在庫商品を自動登録する
 */

import type { Express, Request, Response } from "express";
import { ENV } from "./_core/env";
import { createInventory, createPurchase, getMaxPurchaseNum, getInventories } from "./zaico";
import type { ZaicoInventory } from "./zaico";
import { upsertInventoryExtra, isZaicoEnabled, upsertLocalInventory, upsertLocalPurchase, getDb } from "./db";
import { localInventories as localInvTable } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";

/**
 * 商品名からZaicoカテゴリーを自動判別する（GASと同じロジック）
 * @param productName - 商品名
 * @returns カテゴリー名（判別できない場合は "ゲーム"）
 */
export function getCategoryFromProductName(productName: string): string {
  if (!productName) return "ゲーム";

  // Switch Lite（スイッチライト）→ スイッチライト
  if (/switch\s*lite|スイッチ\s*ライト|switchlite/i.test(productName)) return "スイッチライト";

  // Switch（スイッチ）→ スイッチ
  if (/switch|スイッチ/i.test(productName)) return "スイッチ";

  // Vita2000 → Vita2000
  if (/vita\s*2000|vita2000|pch-2/i.test(productName)) return "Vita2000";

  // Vita1000 → Vita1000
  if (/vita\s*1000|vita1000|pch-1/i.test(productName)) return "Vita1000";

  // New3DSLL → New3DSLL
  if (/new\s*3ds\s*ll|new3dsll|new\s*3ds\s*xl/i.test(productName)) return "New3DSLL";

  // New3DS → New3DS
  if (/new\s*3ds(?!\s*ll|\s*xl)/i.test(productName)) return "New3DS";

  // New2DSLL → New2DSLL
  if (/new\s*2ds\s*ll|new2dsll/i.test(productName)) return "New2DSLL";

  // 3DSLL → 3DSLL
  if (/3ds\s*ll|3dsll|3ds\s*xl/i.test(productName)) return "3DSLL";

  // 3DS → 3DS
  if (/3ds(?!\s*ll|\s*xl)/i.test(productName)) return "3DS";

  // DS lite → DS lite
  if (/ds\s*lite|dslite/i.test(productName)) return "DS lite";

  // DSi LL → DSi LL
  if (/dsi\s*ll|dsi\s*xl/i.test(productName)) return "DSi LL";

  // DSi → DSi
  if (/dsi(?!\s*ll|\s*xl)/i.test(productName)) return "DSi";

  // PSP → PSP
  if (/psp/i.test(productName)) return "PSP";

  // 判別できない場合はゲーム機全般として「ゲーム」
  return "ゲーム";
}

interface GasWebhookPayload {
  secret: string;
  productName: string;       // B列: 在庫用商品名
  srnNumber?: string;        // C列: SRN管理番号
  supplier?: string;         // G列: 仕入先名（URL特定済み）
  supplierUrl?: string;      // I列: 仕入先URL
  supplierDetail?: string;   // N列: 仕入先詳細名（「駿河屋 なんば店」「メルカリ 田中太郎」等）
  etcText?: string;          // 備考欄テキスト（C列\nF列\nG列の3行）
  quantity?: number;         // 在庫数量（0固定）
  orderQuantity?: number;    // 発注数量（J列の値）
  purchasePrice?: number;    // K列: 仕入単価
  category?: string;         // カテゴリー（任意）
  registerType?: "inventory" | "purchase" | "both"; // 登録種別
  purchaseDate?: string;     // 仕入日（F列）
  rowIndex?: number;         // スプレッドシートの行番号（デバッグ用）
}

export function registerWebhookRoutes(app: Express): void {
  /**
   * POST /api/gas-webhook/register-product
   * GAS から呼び出されて商品を登録する
   */
  app.post("/api/gas-webhook/register-product", async (req: Request, res: Response) => {
    try {
      const body = req.body as GasWebhookPayload;

      // 1. シークレットキー認証
      const expectedSecret = ENV.gasWebhookSecret;
      if (!expectedSecret) {
        console.error("[GAS Webhook] GAS_WEBHOOK_SECRET が未設定です");
        return res.status(500).json({ success: false, error: "サーバー設定エラー: シークレットキーが未設定です" });
      }
      if (!body.secret || body.secret !== expectedSecret) {
        console.warn("[GAS Webhook] 認証失敗: 無効なシークレットキー");
        return res.status(401).json({ success: false, error: "認証エラー: シークレットキーが一致しません" });
      }

      // 2. 必須パラメーター検証
      if (!body.productName || body.productName.trim() === "") {
        return res.status(400).json({ success: false, error: "商品名（B列）は必須です" });
      }

      const productName = body.productName.trim();
      const quantity = body.quantity ?? 0;               // 在庫数量（0固定）
      const orderQuantity = body.orderQuantity ?? body.quantity ?? 1;  // 発注数量（J列）
      const purchasePrice = body.purchasePrice;
      const srnNumber = body.srnNumber?.trim() ?? "";
      const registerType = body.registerType ?? "inventory";

      console.log(`[GAS Webhook] 商品登録リクエスト: ${productName} (行: ${body.rowIndex ?? "不明"})`);

      const results: {
        inventory?: { id: number; message: string };
        purchase?: { id: number; message: string };
      } = {};

      // supplier・仕入先URLは登録種別に関わらず共通で使用
      // supplier（G列ベースの組み合わせ済み仕入先名）を優先し、なければsupplierDetail（N列）を使用
      const resolvedSupplierName = body.supplier?.trim() || body.supplierDetail?.trim() || null;
      // https://が抜けている場合に補完
      const normalizedSupplierUrl = body.supplierUrl
        ? (body.supplierUrl.startsWith('http') ? body.supplierUrl : `https://${body.supplierUrl}`)
        : undefined;

       // 3. 在庫データを登録（Zaico連携ON/OFFで分岐）
      const zaicoEnabled = await isZaicoEnabled();
      if (registerType === "inventory" || registerType === "both") {
        // etcフィールド: GASから渡されたetcTextを優先、なければsrnNumberのみ
        const etcValue = body.etcText?.trim() || (srnNumber || undefined);
        // カテゴリー: GASから渡された場合はそれを優先、未指定の場合は商品名から自動判別
        const resolvedCategory = body.category?.trim() || getCategoryFromProductName(productName);

        if (!zaicoEnabled) {
          // Zaico連携OFF: local_inventoriesに直接登録
          await upsertLocalInventory({
            title: productName,
            quantity: quantity,
            unit: "個",
            category: resolvedCategory,
            etc: etcValue ?? null,
            unitPrice: purchasePrice != null ? String(purchasePrice) : null,
            supplierUrl: normalizedSupplierUrl ?? null,
            supplierName: resolvedSupplierName,
            isDeleted: 0,
          });
          // 挿入したレコードのIDを取得（商品名で検索）
          const db = await getDb();
          const inserted = db
            ? await db.select().from(localInvTable)
                .where(eq(localInvTable.title, productName))
                .orderBy(desc(localInvTable.createdAt))
                .limit(1)
            : [];
          const newId = inserted[0]?.id ?? 0;
          results.inventory = { id: newId, message: "在庫登録しました（ローカルDB）" };
          console.log(`[GAS Webhook] 在庫登録成功（ローカルDB）: ID=${newId}`);
        } else {
          // Zaico連携ON: Zaico APIに登録
          const inventoryResult = await createInventory({
            title: productName,
            quantity: String(quantity),
            unit: "個",
            category: resolvedCategory,
            etc: etcValue,
            purchase_unit_price: purchasePrice ?? undefined,
          });
          results.inventory = {
            id: inventoryResult.data_id,
            message: inventoryResult.message,
          };
          console.log(`[GAS Webhook] 在庫登録成功（Zaico）: ID=${inventoryResult.data_id}`);
          if ((resolvedSupplierName || normalizedSupplierUrl) && inventoryResult.data_id) {
            await upsertInventoryExtra({
              zaicoInventoryId: inventoryResult.data_id,
              supplierUrl: normalizedSupplierUrl,
              supplierName: resolvedSupplierName,
            }).catch((e) => console.warn("[GAS Webhook] inventoryExtra保存失敗:", e));
          }
        }
      }

       // 4. 発注済みデータを登録（Zaico連携ONの場合のみ）
      if ((registerType === "purchase" || registerType === "both") && zaicoEnabled) {
        if (!results.inventory?.id) {
          return res.status(400).json({
            success: false,
            error: "発注済み登録には在庫登録が必要です（registerType: 'both' を使用してください）",
          });
        }
        // 発注Noを自動採番
        const maxNum = await getMaxPurchaseNum();
        const nextNum = String(maxNum + 1);
        const purchaseResult = await createPurchase({
          num: nextNum,
          status: "ordered",
          purchase_items: [
            {
              inventory_id: results.inventory.id,
              quantity: orderQuantity,
              unit_price: purchasePrice ?? 0,
              etc: srnNumber ? srnNumber : undefined,
            },
          ],
        });
        results.purchase = {
          id: purchaseResult.data_id,
          message: purchaseResult.message,
        };
        console.log(`[GAS Webhook] 発注済み登録成功: ID=${purchaseResult.data_id}, 発注No=${nextNum}`);
      } else if ((registerType === "purchase" || registerType === "both") && !zaicoEnabled) {
        // Zaico連携OFF: local_purchasesに直接登録
        const localInventoryId = results.inventory?.id ?? null;
        const purchaseDate = body.purchaseDate?.trim() || new Date().toISOString().slice(0, 10);
        const itemsJson = JSON.stringify([{
          inventory_id: localInventoryId,
          title: productName,
          quantity: String(orderQuantity),
          unit_price: purchasePrice ?? null,
          etc: srnNumber || null,
        }]);
        await upsertLocalPurchase({
          status: "ordered",
          itemsJson,
          localInventoryId,
          title: productName,
          category: body.category?.trim() || getCategoryFromProductName(productName),
          quantity: orderQuantity,
          unitPrice: purchasePrice != null ? String(purchasePrice) : undefined,
          managementNo: srnNumber || null,
          purchaseDate,
          supplierUrl: normalizedSupplierUrl ?? null,
          supplierName: resolvedSupplierName,
        });
        results.purchase = { id: 0, message: "発注登録しました（ローカルDB）" };
        console.log(`[GAS Webhook] 発注登録成功（ローカルDB）: ${productName}`);
      }

      return res.json({
        success: true,
        message: "登録が完了しました",
        results,
        productName,
        supplier: body.supplier,
        supplierUrl: body.supplierUrl,
        rowIndex: body.rowIndex,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "不明なエラー";
      console.error("[GAS Webhook] エラー:", message);
      return res.status(500).json({ success: false, error: message });
    }
  });

  /**
   * POST /api/gas-webhook/update-supplier
   * 既存在庫の仕入先詳細名（N列）のみを一括更新するエンドポイント
   * GASのbulkResyncSupplierDetail()から呼び出される
   */
  app.post("/api/gas-webhook/update-supplier", async (req: Request, res: Response) => {
    try {
      const body = req.body as {
        secret: string;
        items: Array<{
          productName: string;        // 商品名（ログ用）
          supplierDetail?: string;    // N列: 仕入先詳細名
          supplier?: string;          // G列: 仕入先名（フォールバック）
          supplierUrl?: string;       // I列: 仕入先URL（フォールバック）
          zaicoInventoryId?: number;  // ZaicoのID（指定がある場合）
          rowIndex: number;           // スプシの行番号（ログ用）
        }>;
      };

      // シークレット検証
      if (!body.secret || body.secret !== process.env.GAS_WEBHOOK_SECRET) {
        return res.status(401).json({ success: false, error: "認証エラー" });
      }

      if (!Array.isArray(body.items) || body.items.length === 0) {
        return res.status(400).json({ success: false, error: "itemsが空です" });
      }

      const results: Array<{ rowIndex: number; productName: string; status: string; supplierName: string | null }> = [];

      for (const item of body.items) {
        const resolvedSupplierName = item.supplierDetail?.trim() || item.supplier?.trim() || null;

        // https://が抜けている場合に補完
        const normalizedItemSupplierUrl = item.supplierUrl
          ? (item.supplierUrl.startsWith('http') ? item.supplierUrl : `https://${item.supplierUrl}`)
          : undefined;

        if (!resolvedSupplierName && !normalizedItemSupplierUrl) {
          results.push({ rowIndex: item.rowIndex, productName: item.productName, status: "skipped", supplierName: null });
          continue;
        }

        // zaicoInventoryIdが指定されている場合はそれを使用
        if (item.zaicoInventoryId) {
          await upsertInventoryExtra({
            zaicoInventoryId: item.zaicoInventoryId,
            supplierUrl: normalizedItemSupplierUrl,
            supplierName: resolvedSupplierName,
          }).catch((e) => console.warn(`[update-supplier] row=${item.rowIndex} 保存失敗:`, e));
          results.push({ rowIndex: item.rowIndex, productName: item.productName, status: "updated", supplierName: resolvedSupplierName });
        } else {
          // zaicoInventoryIdがない場合は商品名でZaico在庫を検索して更新
          try {
            const inventories = await getInventories();
            const matched = inventories.find((inv: ZaicoInventory) =>
              inv.title?.trim() === item.productName.trim()
            );
            if (matched) {
              await upsertInventoryExtra({
                zaicoInventoryId: matched.id,
                supplierUrl: item.supplierUrl,
                supplierName: resolvedSupplierName,
              });
              results.push({ rowIndex: item.rowIndex, productName: item.productName, status: "updated", supplierName: resolvedSupplierName });
            } else {
              results.push({ rowIndex: item.rowIndex, productName: item.productName, status: "not_found", supplierName: null });
            }
          } catch (e) {
            results.push({ rowIndex: item.rowIndex, productName: item.productName, status: "error", supplierName: null });
          }
        }
      }

      const updated = results.filter((r) => r.status === "updated").length;
      const skipped = results.filter((r) => r.status === "skipped").length;
      const notFound = results.filter((r) => r.status === "not_found").length;

      console.log(`[update-supplier] 完了: 更新=${updated}, スキップ=${skipped}, 未発見=${notFound}`);
      return res.json({ success: true, updated, skipped, notFound, results });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "不明なエラー";
      console.error("[update-supplier] エラー:", message);
      return res.status(500).json({ success: false, error: message });
    }
  });

  /**
   * GET /api/gas-webhook/health
   * GAS からの疎通確認用エンドポイント（認証不要）
   */
  app.get("/api/gas-webhook/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });
}
