import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, bigint } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * 入庫補足情報テーブル
 * Zaico側に保存できない発送日・追跡番号などを本システムで管理する
 */
export const purchaseExtras = mysqlTable("purchase_extras", {
  id: int("id").autoincrement().primaryKey(),
  /** Zaico側の入庫データID */
  zaicoId: int("zaicoId").notNull().unique(),
  /** 仕入先発送日 */
  shipDate: varchar("shipDate", { length: 20 }),
  /** 追跡番号 */
  trackingNumber: varchar("trackingNumber", { length: 200 }),
  /** 配送業者（手動上書き用） */
  carrier: varchar("carrier", { length: 50 }),
  /** 備考 */
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PurchaseExtra = typeof purchaseExtras.$inferSelect;
export type InsertPurchaseExtra = typeof purchaseExtras.$inferInsert;

/**
 * 出庫履歴テーブル
 * まとめて出庫処理の結果を保存する
 */
export const deliveryHistories = mysqlTable("delivery_histories", {
  id: int("id").autoincrement().primaryKey(),
  /** 出庫No（ユーザー入力） */
  deliveryNo: varchar("deliveryNo", { length: 200 }).notNull(),
  /** Zaico側で作成された出庫データID */
  zaicoDeliveryId: int("zaicoDeliveryId"),
  /** 出庫商品情報（JSON文字列） */
  itemsJson: text("itemsJson").notNull(),
  /** 出庫処理ステータス */
  status: mysqlEnum("status", ["success", "error"]).notNull(),
  /** エラーメッセージ（エラー時） */
  errorMessage: text("errorMessage"),
  /** Zaicoから削除済みと判明した商品のinventoryIdのJSON配列文字列 */
  deletedInventoryIdsJson: text("deletedInventoryIdsJson"),
  /** 出庫取り消し済み商品情報（JSON文字列: [{inventoryId, quantity, cancelledAt}]） */
  cancelledItemsJson: text("cancelledItemsJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DeliveryHistory = typeof deliveryHistories.$inferSelect;
export type InsertDeliveryHistory = typeof deliveryHistories.$inferInsert;

/**
 * 入庫履歴テーブル
 * 入庫ボタン押下時の入庫処理結果を保存する
 */
export const purchaseHistories = mysqlTable("purchase_histories", {
  id: int("id").autoincrement().primaryKey(),
  /** Zaico側の入庫データID */
  zaicoId: int("zaicoId").notNull(),
  /** 管理番号（etcフィールドの1番目） */
  kanriNo: varchar("kanriNo", { length: 200 }),
  /** 商品名 */
  title: varchar("title", { length: 500 }).notNull(),
  /** カテゴリ */
  category: varchar("category", { length: 200 }),
  /** 仕入れ先 */
  supplier: varchar("supplier", { length: 200 }),
  /** 入庫数量 */
  quantity: varchar("quantity", { length: 50 }).notNull(),
  /** 入庫単価 */
  unitPrice: varchar("unitPrice", { length: 50 }),
  /** 入庫日 */
  purchaseDate: varchar("purchaseDate", { length: 20 }).notNull(),
  /** Zaico側の在庫ID */
  inventoryId: int("inventoryId"),
  /** 入庫取り消し済みか */
  cancelled: int("cancelled").default(0).notNull(),
  /** 入庫処理したユーザー名 */
  operatorName: varchar("operatorName", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PurchaseHistory = typeof purchaseHistories.$inferSelect;
export type InsertPurchaseHistory = typeof purchaseHistories.$inferInsert;

/**
 * 削除済み商品テーブル
 * 在庫一覧から削除した商品のスナップショットを保存する（復元機能用）
 */
export const deletedInventories = mysqlTable("deleted_inventories", {
  id: int("id").autoincrement().primaryKey(),
  /** Zaico側の元在庫データid */
  zaicoId: int("zaicoId").notNull(),
  /** 商品名 */
  title: varchar("title", { length: 500 }).notNull(),
  /** カテゴリ */
  category: varchar("category", { length: 200 }),
  /** 保管場所 */
  place: varchar("place", { length: 200 }),
  /** 在庫数 */
  quantity: varchar("quantity", { length: 50 }),
  /** 単位 */
  unit: varchar("unit", { length: 50 }),
  /** 仕入単価 */
  unitPrice: varchar("unitPrice", { length: 50 }),
  /** 備考 */
  etc: text("etc"),
  /** 元在庫データのJSON全体（復元用） */
  snapshotJson: text("snapshotJson").notNull(),
  /** 削除したオペレーター名 */
  deletedBy: varchar("deletedBy", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DeletedInventory = typeof deletedInventories.$inferSelect;
export type InsertDeletedInventory = typeof deletedInventories.$inferInsert;

/**
 * 在庫補足情報テーブル
 * Zaico側に保存できない在庫商品の補足情報（仕入先URL等）を管理する
 */
export const inventoryExtras = mysqlTable("inventory_extras", {
  id: int("id").autoincrement().primaryKey(),
  /** Zaico側の在庫ID */
  zaicoInventoryId: int("zaicoInventoryId").notNull().unique(),
  /** 仕入先URL */
  supplierUrl: text("supplierUrl"),
  /** 仕入先名 */
  supplierName: varchar("supplierName", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type InventoryExtra = typeof inventoryExtras.$inferSelect;
export type InsertInventoryExtra = typeof inventoryExtras.$inferInsert;

/**
 * 在庫メモテーブル
 * 在庫数増減時に入力したメモを保存する
 */
export const inventoryMemos = mysqlTable("inventory_memos", {
  id: int("id").autoincrement().primaryKey(),
  /** Zaico側の在庫ID */
  zaicoInventoryId: int("zaicoInventoryId").notNull(),
  /** 商品名 */
  title: varchar("title", { length: 500 }),
  /** 数量変更の種類（increase/decrease/set） */
  changeType: varchar("changeType", { length: 20 }).notNull(),
  /** 変更前の数量 */
  quantityBefore: int("quantityBefore"),
  /** 変更後の数量 */
  quantityAfter: int("quantityAfter"),
  /** 変更量（正数＝増加、負数＝減少） */
  quantityDelta: int("quantityDelta"),
  /** メモ */
  memo: text("memo"),
  /** 操作者名 */
  operatorName: varchar("operatorName", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InventoryMemo = typeof inventoryMemos.$inferSelect;
export type InsertInventoryMemo = typeof inventoryMemos.$inferInsert;

/**
 * ローカル在庫マスタテーブル
 * Zaicoから移行・またはサイト内で管理する在庫商品マスタ
 * Zaico連携ON時はZaico APIと同期、OFF時はこのテーブルのみを参照する
 */
export const localInventories = mysqlTable("local_inventories", {
  id: int("id").autoincrement().primaryKey(),
  /** ZaicoのID（Zaicoから同期した場合のみ設定） */
  zaicoId: int("zaicoId").unique(),
  /** 商品名 */
  title: varchar("title", { length: 500 }).notNull(),
  /** カテゴリ */
  category: varchar("category", { length: 200 }),
  /** 保管場所 */
  place: varchar("place", { length: 200 }),
  /** 在庫数 */
  quantity: int("quantity").default(0).notNull(),
  /** 単位 */
  unit: varchar("unit", { length: 50 }).default("個"),
  /** 仕入単価 */
  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }),
  /** 備考欄（管理番号等） */
  etc: text("etc"),
  /** 仕入先URL */
  supplierUrl: text("supplierUrl"),
  /** 仕入先名 */
  supplierName: varchar("supplierName", { length: 200 }),
  /** 削除済みフラグ */
  isDeleted: int("isDeleted").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LocalInventory = typeof localInventories.$inferSelect;
export type InsertLocalInventory = typeof localInventories.$inferInsert;

/**
 * ローカル発注テーブル
 * Zaicoから移行・またはサイト内で管理する発注データ
 * Zaico連携ON時はZaico APIと同期、OFF時はこのテーブルのみを参照する
 */
export const localPurchases = mysqlTable("local_purchases", {
  id: int("id").autoincrement().primaryKey(),
  /** ZaicoのID（Zaicoから同期した場合のみ設定） */
  zaicoId: bigint("zaicoId", { mode: "number" }).unique(),
  /** Zaico発注No */
  purchaseNum: varchar("purchaseNum", { length: 100 }),
  /** ステータス（ordered/purchased） */
  status: varchar("status", { length: 50 }).notNull().default("ordered"),
  /** 発注商品情報（JSON: [{inventory_id, title, quantity, unit_price, etc}]） */
  itemsJson: text("itemsJson").notNull(),
  /** 在庫ID（localInventories.id） */
  localInventoryId: int("localInventoryId"),
  /** 商品名（スナップショット） */
  title: varchar("title", { length: 500 }),
  /** カテゴリ */
  category: varchar("category", { length: 200 }),
  /** 数量 */
  quantity: int("quantity").default(1).notNull(),
  /** 仕入単価 */
  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }),
  /** 管理番号（etcフィールド） */
  managementNo: varchar("managementNo", { length: 200 }),
  /** 発注日 */
  purchaseDate: varchar("purchaseDate", { length: 20 }),
  /** 入庫日 */
  receivedDate: varchar("receivedDate", { length: 20 }),
  /** 仕入先発送日 */
  shipDate: varchar("shipDate", { length: 20 }),
  /** 追跡番号 */
  trackingNumber: varchar("trackingNumber", { length: 200 }),
  /** 配送業者 */
  carrier: varchar("carrier", { length: 50 }),
  /** 備考 */
  note: text("note"),
  /** 仕入先URL */
  supplierUrl: varchar("supplierUrl", { length: 500 }),
  /** 仕入先名（「Amazon モノモロストア」等「サイト名+出品者名」） */
  supplierName: varchar("supplierName", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type LocalPurchase = typeof localPurchases.$inferSelect;
export type InsertLocalPurchase = typeof localPurchases.$inferInsert;

/**
 * システム設定テーブル
 * Zaico連携ON/OFF等のシステム設定を保存する
 */
export const systemSettings = mysqlTable("system_settings", {
  id: int("id").autoincrement().primaryKey(),
  /** 設定キー */
  key: varchar("key", { length: 100 }).notNull().unique(),
  /** 設定値 */
  value: text("value").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = typeof systemSettings.$inferInsert;

/** インボイス商品種別メモ（発注管理画面のカラー別メモ） */
export const invoiceMemos = mysqlTable("invoice_memos", {
  id: int("id").autoincrement().primaryKey(),
  /** インボイスNo（例: "371"） */
  invoiceKey: varchar("invoice_key", { length: 50 }).notNull(),
  /** 商品種別キー（例: "New3DS ランダムカラー"） */
  colorKey: varchar("color_key", { length: 200 }).notNull(),
  /** メモ内容 */
  memo: text("memo").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type InvoiceMemo = typeof invoiceMemos.$inferSelect;
export type InsertInvoiceMemo = typeof invoiceMemos.$inferInsert;

/**
 * 月次棚卸しレポートテーブル
 * 月末に生成・保存する棚卸しレポートのヘッダー情報
 */
export const monthlyReports = mysqlTable("monthly_reports", {
  id: int("id").autoincrement().primaryKey(),
  /** レポート対象年月（例: "2026-03"） */
  yearMonth: varchar("year_month", { length: 7 }).notNull(),
  /** レポート名（任意） */
  label: varchar("label", { length: 200 }),
  /** 在庫金額サマリー（JSON文字列） */
  inventorySummaryJson: text("inventory_summary_json"),
  /** 支払済み未完了インボイス一覧（JSON文字列） */
  invoiceListJson: text("invoice_list_json"),
  /** 作成者名 */
  createdBy: varchar("created_by", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MonthlyReport = typeof monthlyReports.$inferSelect;
export type InsertMonthlyReport = typeof monthlyReports.$inferInsert;

/**
 * 月次レポート インボイス別仕入れコストテーブル
 * 各インボイスの商品別仕入れ単価（手入力分）を保存する
 */
export const monthlyReportCosts = mysqlTable("monthly_report_costs", {
  id: int("id").autoincrement().primaryKey(),
  /** 月次レポートID */
  reportId: int("report_id").notNull(),
  /** インボイスNo */
  invoiceKey: varchar("invoice_key", { length: 50 }).notNull(),
  /** 商品識別キー（Zaico商品IDまたは商品名） */
  itemKey: varchar("item_key", { length: 500 }).notNull(),
  /** 商品名 */
  title: varchar("title", { length: 500 }),
  /** 数量 */
  quantity: int("quantity").default(0).notNull(),
  /** 仕入れ単価（手入力またはZaicoから自動取得） */
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }),
  /** 小計（単価xd7数量） */
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }),
  /** アイテム種別（"ordered"展開済み / "stock"在庫） */
  itemType: varchar("item_type", { length: 20 }).notNull().default("ordered"),
  /** 小数入力か（true=手入力） */
  isManual: int("is_manual").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MonthlyReportCost = typeof monthlyReportCosts.$inferSelect;
export type InsertMonthlyReportCost = typeof monthlyReportCosts.$inferInsert;

/**
 * 月次棚卸し インボイス別手動入力行テーブル
 * 未完了インボイスの在庫一覧に自由に追加できる手動入力行を保存する
 */
export const invoiceManualItems = mysqlTable("invoice_manual_items", {
  id: int("id").autoincrement().primaryKey(),
  /** インボイスNo（例: "371"） */
  invoiceNo: varchar("invoice_no", { length: 50 }).notNull(),
  /** 商品名 */
  title: varchar("title", { length: 500 }).notNull().default(""),
  /** 数量 */
  quantity: int("quantity").notNull().default(1),
  /** 仕入単価（円） */
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }),
  /** 表示順 */
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type InvoiceManualItem = typeof invoiceManualItems.$inferSelect;
export type InsertInvoiceManualItem = typeof invoiceManualItems.$inferInsert;

/**
 * 国内卸商品マスタテーブル
 * 月次棚卸しレポートで使用する国内卸（toynet等）の発注商品を管理する
 */
export const domesticProducts = mysqlTable("domestic_products", {
  id: int("id").autoincrement().primaryKey(),
  /** 商品名 */
  title: varchar("title", { length: 500 }).notNull(),
  /** 仕入単価（円） */
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }),
  /** 仕入先名（例: toynet, 益子商会） */
  supplierName: varchar("supplier_name", { length: 200 }),
  /** メモ */
  note: text("note"),
  /** 表示順 */
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DomesticProduct = typeof domesticProducts.$inferSelect;
export type InsertDomesticProduct = typeof domesticProducts.$inferInsert;

/**
 * 月次棚卸し 国内卸発注行テーブル
 * 月次レポートの国内卸セクションに追加する行（マスタ選択または手動入力）
 */
export const monthlyDomesticItems = mysqlTable("monthly_domestic_items", {
  id: int("id").autoincrement().primaryKey(),
  /** 対象年月（例: "2026-03"） */
  yearMonth: varchar("year_month", { length: 7 }).notNull(),
  /** 国内卸商品マスタID（マスタから選択した場合） */
  domesticProductId: int("domestic_product_id"),
  /** 商品名（手動入力または選択時のスナップショット） */
  title: varchar("title", { length: 500 }).notNull().default(""),
  /** 数量 */
  quantity: int("quantity").notNull().default(1),
  /** 仕入単価（円）（手動入力または選択時のスナップショット） */
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }),
  /** 仕入先名 */
  supplierName: varchar("supplier_name", { length: 200 }),
  /** メモ */
  note: text("note"),
  /** 支払済みフラグ（0=未払い, 1=支払済み） */
  isPaid: int("is_paid").notNull().default(0),
  /** 表示順 */
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MonthlyDomesticItem = typeof monthlyDomesticItems.$inferSelect;
export type InsertMonthlyDomesticItem = typeof monthlyDomesticItems.$inferInsert;

/**
 * 取引先マスタテーブル
 * 出庫Noの自動生成に使用する取引先情報を管理する
 * 管理番号の2番目のセグメント（例: 371_ルカ_... の「ルカ」）と照合する
 */
export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  /** 表示名（例: ルカ） */
  displayName: varchar("displayName", { length: 100 }).notNull(),
  /** 出庫Noに使うコード（例: luca） */
  code: varchar("code", { length: 100 }).notNull(),
  /** 管理番号内のキーワード（カンマ区切りで複数指定可、例: ルカ,luca） */
  keywords: varchar("keywords", { length: 500 }).notNull(),
  /** 表示順 */
  sortOrder: int("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;

/**
 * 認証済みユーザーテーブル
 * 認証コードを入力して認証済みになったユーザーを記録する
 * 一度認証したユーザーは次回以降コード入力不要
 */
export const authorizedUsers = mysqlTable("authorized_users", {
  id: int("id").autoincrement().primaryKey(),
  /** ログインユーザーの openId */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  /** ユーザー名（表示用） */
  name: text("name"),
  /** メールアドレス */
  email: varchar("email", { length: 320 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuthorizedUser = typeof authorizedUsers.$inferSelect;
export type InsertAuthorizedUser = typeof authorizedUsers.$inferInsert;

/**
 * FedEx発送記録テーブル
 * 出庫グループ（deliveryNo）に紐づくFedEx発送情報を管理する
 * スプレッドシートへの自動書き込みに使用
 */
export const fedexShipments = mysqlTable("fedex_shipments", {
  id: int("id").autoincrement().primaryKey(),
  /** 出庫No（deliveryHistoriesのdeliveryNoと対応） */
  deliveryNo: varchar("deliveryNo", { length: 200 }).notNull(),
  /** 書き込み先スプシシート名（例: 独発送管理、サミー発送管理） */
  sheetName: varchar("sheetName", { length: 100 }).notNull(),
  /** 発送日（スプシのヘッダーと一致する形式: 例 3/26） */
  shippingDate: varchar("shippingDate", { length: 20 }).notNull(),
  /** FedEx追跡番号 */
  trackingNumber: varchar("trackingNumber", { length: 100 }).notNull(),
  /** 発送商品情報JSON（[{productNameJa, productNameEn, quantity}]） */
  itemsJson: text("itemsJson").notNull(),
  /** スプシ書き込みステータス */
  spreadsheetStatus: mysqlEnum("spreadsheetStatus", ["pending", "success", "error"]).default("pending").notNull(),
  /** スプシ書き込みエラーメッセージ */
  spreadsheetError: text("spreadsheetError"),
  /** 登録したオペレーター名 */
  operatorName: varchar("operatorName", { length: 200 }),
  /** 紐付く出庫履歴ID（delivery_histories.id）。1件のFedEx発送が1件の出庫履歴に対応 */
  historyId: int("historyId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type FedexShipment = typeof fedexShipments.$inferSelect;
export type InsertFedexShipment = typeof fedexShipments.$inferInsert;

/**
 * 取引先ポータル認証テーブル
 * 取引先（ルカ、サミー等）のパスワードとセッショントークンを管理する
 */
export const partnerPortals = mysqlTable("partner_portals", {
  id: int("id").autoincrement().primaryKey(),
  /** 取引先コード（例: luca, sammy）— URLスラグとして使用 */
  partnerCode: varchar("partnerCode", { length: 100 }).notNull().unique(),
  /** 取引先表示名（英語、例: Luca, Sammy） */
  partnerName: varchar("partnerName", { length: 200 }).notNull(),
  /** 対応するスプシシート名（例: 独発送管理、サミー発送管理） */
  sheetName: varchar("sheetName", { length: 100 }).notNull(),
  /** パスワード（平文保存、管理者が設定） */
  password: varchar("password", { length: 200 }).notNull(),
  /** セッショントークン（ログイン時に発行） */
  sessionToken: varchar("sessionToken", { length: 200 }),
  /** セッション有効期限 */
  sessionExpiresAt: timestamp("sessionExpiresAt"),
  /** 有効フラグ */
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type PartnerPortal = typeof partnerPortals.$inferSelect;
export type InsertPartnerPortal = typeof partnerPortals.$inferInsert;

/**
 * 受取確認チェックテーブル
 * 取引先が発送記録の各商品行にチェックを入れた状態を保存する
 */
export const shipmentChecks = mysqlTable("shipment_checks", {
  id: int("id").autoincrement().primaryKey(),
  /** FedEx発送記録ID（fedexShipments.id） */
  fedexShipmentId: int("fedexShipmentId").notNull(),
  /** 商品インデックス（itemsJson内の配列インデックス） */
  itemIndex: int("itemIndex").notNull(),
  /** チェック済みフラグ（0=未確認, 1=確認済み） */
  isChecked: int("isChecked").default(0).notNull(),
  /** チェックした取引先コード */
  partnerCode: varchar("partnerCode", { length: 100 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ShipmentCheck = typeof shipmentChecks.$inferSelect;
export type InsertShipmentCheck = typeof shipmentChecks.$inferInsert;

/**
 * 取引先メッセージテーブル
 * 取引先から管理者へのメッセージ（不足・不備報告等）を保存する
 */
export const partnerMessages = mysqlTable("partner_messages", {
  id: int("id").autoincrement().primaryKey(),
  /** 送信した取引先コード */
  partnerCode: varchar("partnerCode", { length: 100 }).notNull(),
  /** 取引先表示名 */
  partnerName: varchar("partnerName", { length: 200 }).notNull(),
  /** 関連するFedEx発送記録ID（任意） */
  fedexShipmentId: int("fedexShipmentId"),
  /** メッセージ内容 */
  message: text("message").notNull(),
  /** 管理者が既読にしたか */
  isRead: int("isRead").default(0).notNull(),
  /** 管理者からの返信テキスト */
  replyText: text("replyText"),
  /** 返信日時 */
  repliedAt: timestamp("repliedAt"),
  /** 削除フラグ（管理者が削除した場合） */
  isDeleted: int("isDeleted").default(0).notNull(),
  /** 取引先側削除フラグ */
  isDeletedByPartner: int("isDeletedByPartner").default(0).notNull(),
  /** 取引先が管理者からの返信を既読にしたか */
  isReadByPartner: int("isReadByPartner").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type PartnerMessage = typeof partnerMessages.$inferSelect;
export type InsertPartnerMessage = typeof partnerMessages.$inferInsert;

/**
 * メッセージスレッドテーブル
 * partner_messagesの最初のメッセージに対するスレッド形式の追加返信を保存する
 */
export const partnerMessageThreads = mysqlTable("partner_message_threads", {
  id: int("id").autoincrement().primaryKey(),
  /** 親メッセージID (partner_messages.id) */
  parentMessageId: int("parentMessageId").notNull(),
  /** 送信者種別: 'admin' | 'partner' */
  senderType: varchar("senderType", { length: 20 }).notNull(),
  /** 送信者名 */
  senderName: varchar("senderName", { length: 200 }).notNull(),
  /** メッセージ内容 */
  content: text("content").notNull(),
  /** 取引先が既読にしたか（admin送信時に使用） */
  isReadByPartner: int("isReadByPartner").default(0).notNull(),
  /** 管理者が既読にしたか（partner送信時に使用） */
  isReadByAdmin: int("isReadByAdmin").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type PartnerMessageThread = typeof partnerMessageThreads.$inferSelect;
export type InsertPartnerMessageThread = typeof partnerMessageThreads.$inferInsert;

/**
 * 手動発送記録テーブル
 * スプシ連携なしで手動入力した発送データを管理する
 */
export const manualShipments = mysqlTable("manual_shipments", {
  id: int("id").autoincrement().primaryKey(),
  /** インボイスNo */
  invoiceNo: varchar("invoiceNo", { length: 50 }).notNull(),
  /** 書き込み先スプシシート名（例: 独発送管理、サミー発送管理） */
  sheetName: varchar("sheetName", { length: 100 }).notNull(),
  /** 発送日（例: 3/26） */
  shippingDate: varchar("shippingDate", { length: 20 }).notNull(),
  /** 追跡番号 */
  trackingNumber: varchar("trackingNumber", { length: 100 }).notNull(),
  /** 発送商品情報JSON（[{productNameJa, productNameEn, quantity}]） */
  itemsJson: text("itemsJson").notNull(),
  /** 登録したオペレーター名 */
  operatorName: varchar("operatorName", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ManualShipment = typeof manualShipments.$inferSelect;
export type InsertManualShipment = typeof manualShipments.$inferInsert;
