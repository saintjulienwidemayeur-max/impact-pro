# Entity Relationship Plan

This is the planning view of the data model. The Prisma schema in `apps/api/prisma/schema.prisma` is the implementation and must stay consistent with this document.

Conventions for all tables:
- `id String @id @default(cuid())`; `createdAt`, `updatedAt` timestamps.
- Money is stored as `Decimal(12,2)` plus a `currency` (`HTG` default, `USD` allowed).
- Quantities are `Int`.
- Soft delete (`deletedAt`) only on catalog and master data. Never on ledgers or orders.
- Tenant-owned tables carry `organizationId` with `@@index([organizationId, ...])`.

## 1. Identity & organizations

```mermaid
erDiagram
  User ||--o{ Membership : has
  Organization ||--o{ Membership : has
  Role ||--o{ Membership : grants
  Role ||--o{ RolePermission : has
  Permission ||--o{ RolePermission : in
  User ||--o{ Session : has
  User ||--o{ StaffRole : has
  Role ||--o{ StaffRole : grants
  Organization ||--o{ Address : has
  Organization ||--o{ Invitation : sends

  User { string id PK; string email UK; string passwordHash; string firstName; string lastName; string phone; UserStatus status; datetime emailVerifiedAt; datetime lastLoginAt }
  Organization { string id PK; string name; string slug UK; OrgType type; OrgStatus status; string taxId; string billingEmail }
  Membership { string id PK; string userId FK; string organizationId FK; string roleId FK }
  Role { string id PK; string key UK; RoleScope scope }
  Permission { string id PK; string key UK }
  StaffRole { string userId FK; string roleId FK }
  Session { string id PK; string userId FK; string refreshTokenHash; string family; datetime expiresAt; datetime revokedAt; string ip; string userAgent }
  Invitation { string id PK; string organizationId FK; string email; string roleId FK; string tokenHash UK; datetime expiresAt; datetime acceptedAt }
  Address { string id PK; string organizationId FK; string label; string line1; string city; string department; string country; string phone }
```

- Enums: `UserStatus(ACTIVE, INVITED, SUSPENDED)`, `OrgType(INTERNAL, CUSTOMER, SUPPLIER)`, `OrgStatus(ACTIVE, SUSPENDED)`, `RoleScope(STAFF, ORGANIZATION)`.
- Unique: `Membership(userId, organizationId)`, `RolePermission(roleId, permissionId)`, `StaffRole(userId, roleId)`.
- Index: `Session(userId)`, `Session(family)`.

## 2. Catalog & pricing

```mermaid
erDiagram
  Category ||--o{ Category : parent
  Category ||--o{ ProductCategory : in
  Product ||--o{ ProductCategory : in
  Product ||--o{ ProductVariant : has
  Product ||--o{ ProductImage : has
  Product ||--o{ ProductAttributeValue : has
  Attribute ||--o{ AttributeOption : has
  AttributeOption ||--o{ VariantOptionValue : selects
  ProductVariant ||--o{ VariantOptionValue : has
  Product ||--o{ DecorationOption : offers
  ProductVariant ||--o{ PriceTier : has
  PriceList ||--o{ PriceListItem : has
  ProductVariant ||--o{ PriceListItem : priced
  Organization ||--o{ PriceList : "custom pricing"

  Product { string id PK; string slug UK; string name; text description; ProductStatus status; int minOrderQty; int leadTimeDays; string seoTitle; string seoDescription }
  ProductVariant { string id PK; string productId FK; string sku UK; string name; decimal basePrice; decimal cost; int weightGrams; bool isActive }
  Category { string id PK; string parentId FK; string slug UK; string name; int sortOrder }
  Attribute { string id PK; string key UK; string name; AttributeType type }
  AttributeOption { string id PK; string attributeId FK; string value; string label }
  PriceTier { string id PK; string variantId FK; int minQty; decimal unitPrice }
  PriceList { string id PK; string organizationId FK; string name; datetime validFrom; datetime validTo }
  PriceListItem { string id PK; string priceListId FK; string variantId FK; int minQty; decimal unitPrice }
  DecorationOption { string id PK; string productId FK; DecorationMethod method; string location; decimal setupFee; decimal unitFee; int maxColors }
  ProductImage { string id PK; string productId FK; string fileId FK; int sortOrder; string alt }
```

- Enums: `ProductStatus(DRAFT, ACTIVE, ARCHIVED)`, `AttributeType(SELECT, COLOR, SIZE, TEXT)`, `DecorationMethod(SCREEN_PRINT, EMBROIDERY, SUBLIMATION, PAD_PRINT, LASER_ENGRAVING, DIGITAL_PRINT, VINYL)`.
- Unique: `PriceTier(variantId, minQty)`, `PriceListItem(priceListId, variantId, minQty)`, `AttributeOption(attributeId, value)`, `VariantOptionValue(variantId, attributeId)`.
- Index: `ProductVariant(productId)`, `Product(status)`.
- Price resolution order: org `PriceList` (if valid) → `PriceTier` for qty → `basePrice`, then add decoration fees.

## 3. Commerce (carts, checkout, orders, payments)

```mermaid
erDiagram
  Cart ||--o{ CartItem : has
  Order ||--o{ OrderItem : has
  Order ||--o{ Payment : paid_by
  Order ||--o{ OrderStatusHistory : logs
  OrderItem }o--|| ProductVariant : refs
  Organization ||--o{ Order : places
  User ||--o{ Order : placed_by
  Order ||--o{ Shipment : ships_in

  Cart { string id PK; string userId FK; string organizationId FK; string anonymousToken UK; CartStatus status; datetime expiresAt }
  CartItem { string id PK; string cartId FK; string variantId FK; int quantity; json decoration; string artworkFileId FK }
  Order { string id PK; string number UK; string organizationId FK; string userId FK; OrderStatus status; decimal subtotal; decimal discountTotal; decimal taxTotal; decimal shippingTotal; decimal grandTotal; string currency; json shippingAddress; json billingAddress; string programId FK }
  OrderItem { string id PK; string orderId FK; string variantId FK; string skuSnapshot; string nameSnapshot; decimal unitPriceSnapshot; decimal decorationFeeSnapshot; int quantity; decimal lineTotal; json decorationSnapshot }
  Payment { string id PK; string orderId FK; PaymentProvider provider; string providerRef UK; PaymentStatus status; decimal amount; string currency; string idempotencyKey UK; json rawWebhook }
  OrderStatusHistory { string id PK; string orderId FK; OrderStatus from; OrderStatus to; string actorId; string note }
  Quote { string id PK; string organizationId FK; string email; QuoteStatus status; json items; decimal total }
```

- Enums: `CartStatus(ACTIVE, CONVERTED, ABANDONED)`, `OrderStatus(PENDING_PAYMENT, PAID, ARTWORK_REVIEW, IN_PRODUCTION, QUALITY_CHECK, READY_TO_SHIP, PARTIALLY_SHIPPED, SHIPPED, DELIVERED, CANCELLED, REFUNDED)`, `PaymentProvider(CARD_GATEWAY, MONCASH, NATCASH, BANK_TRANSFER, INVOICE)`, `PaymentStatus(PENDING, AUTHORIZED, CAPTURED, FAILED, REFUNDED, PARTIALLY_REFUNDED)`, `QuoteStatus(DRAFT, SENT, ACCEPTED, EXPIRED)`.
- Unique: `CartItem(cartId, variantId, decorationHash)`.
- Index: `Order(organizationId, createdAt)`, `Order(status)`, `Payment(orderId)`.
- **Price snapshotting.** `OrderItem` copies SKU, name, unit price, decoration fee and decoration spec when the order is placed. Reports and invoices read only the snapshot. Later catalog edits never change historical orders.

## 4. Suppliers & procurement

```mermaid
erDiagram
  Supplier ||--o{ SupplierContact : has
  Supplier ||--o{ SupplierProduct : supplies
  ProductVariant ||--o{ SupplierProduct : sourced
  Supplier ||--o{ PurchaseOrder : receives
  PurchaseOrder ||--o{ PurchaseOrderItem : has
  PurchaseOrder ||--o{ GoodsReceipt : received_by
  GoodsReceipt ||--o{ GoodsReceiptItem : has
  Warehouse ||--o{ PurchaseOrder : ships_to

  Supplier { string id PK; string code UK; string name; SupplierStatus status; string email; string phone; string country; int leadTimeDays; string paymentTerms; decimal rating }
  SupplierProduct { string id PK; string supplierId FK; string variantId FK; string supplierSku; decimal unitCost; int moq; bool preferred }
  PurchaseOrder { string id PK; string number UK; string supplierId FK; string warehouseId FK; POStatus status; date expectedAt; decimal total; string currency; string approvedById FK }
  PurchaseOrderItem { string id PK; string purchaseOrderId FK; string variantId FK; int quantityOrdered; int quantityReceived; decimal unitCost }
  GoodsReceipt { string id PK; string purchaseOrderId FK; string receivedById FK; datetime receivedAt }
  GoodsReceiptItem { string id PK; string goodsReceiptId FK; string poItemId FK; string locationId FK; int quantity; int damagedQty }
```

- Enums: `SupplierStatus(ACTIVE, ON_HOLD, INACTIVE)`, `POStatus(DRAFT, PENDING_APPROVAL, APPROVED, SENT, PARTIALLY_RECEIVED, RECEIVED, CANCELLED)`.
- Unique: `SupplierProduct(supplierId, variantId)`, `PurchaseOrderItem(purchaseOrderId, variantId)`.
- Check: `quantityReceived <= quantityOrdered`.
- Each goods receipt posts `RECEIPT` movements to the inventory ledger.

## 5. Inventory & warehousing

```mermaid
erDiagram
  Warehouse ||--o{ WarehouseLocation : has
  WarehouseLocation ||--o{ InventoryBalance : holds
  ProductVariant ||--o{ InventoryBalance : stocked
  InventoryBalance ||--o{ InventoryMovement : ledger
  InventoryBalance ||--o{ InventoryReservation : reserved
  Warehouse ||--o{ StockTransfer : from_to
  StockTransfer ||--o{ StockTransferItem : has
  InventoryCount ||--o{ InventoryCountLine : has

  Warehouse { string id PK; string code UK; string name; json address; bool isActive }
  WarehouseLocation { string id PK; string warehouseId FK; string code; LocationType type }
  InventoryBalance { string id PK; string variantId FK; string locationId FK; string organizationId FK; int onHand; int reserved; int damaged; int inTransit; int reorderPoint; int version }
  InventoryMovement { string id PK; string balanceId FK; MovementType type; int quantity; string referenceType; string referenceId; string actorId; string reason; datetime createdAt }
  InventoryReservation { string id PK; string balanceId FK; int quantity; ReservationStatus status; string referenceType; string referenceId; datetime expiresAt }
  StockTransfer { string id PK; string number UK; string fromWarehouseId FK; string toWarehouseId FK; TransferStatus status }
  InventoryCount { string id PK; string warehouseId FK; CountStatus status; datetime startedAt; datetime completedAt }
```

- Enums: `LocationType(RECEIVING, STORAGE, PICKING, PACKING, QUARANTINE, SHIPPING)`, `MovementType(RECEIPT, SHIPMENT, ADJUSTMENT_IN, ADJUSTMENT_OUT, TRANSFER_OUT, TRANSFER_IN, DAMAGE, RETURN, RESERVE, RELEASE, KIT_CONSUME, KIT_PRODUCE)`, `ReservationStatus(ACTIVE, CONSUMED, RELEASED, EXPIRED)`, `TransferStatus(DRAFT, IN_TRANSIT, RECEIVED, CANCELLED)`, `CountStatus(OPEN, SUBMITTED, RECONCILED)`.
- Unique: `WarehouseLocation(warehouseId, code)`, `InventoryBalance(variantId, locationId, organizationId)`. `organizationId` is null for house stock and set for customer-owned stock.
- Index: `InventoryMovement(balanceId, createdAt)`, `InventoryMovement(referenceType, referenceId)`, `InventoryReservation(status, expiresAt)`.
- Checks (raw SQL in the migration): `onHand >= 0`, `reserved >= 0`, `damaged >= 0`, `reserved <= onHand - damaged`.

### Ledger and reservation strategy

- **The ledger is immutable.** `InventoryMovement` is insert-only. Migrations revoke `UPDATE/DELETE` on the table from the app DB role, and a trigger raises on update or delete. Corrections are compensating movements.
- **`InventoryBalance` is a projection** of the ledger, updated in the *same transaction* as each movement. Nightly reconciliation recomputes balances from the ledger and alerts on drift.
- **Available** = `onHand − reserved − damaged`. In-transit stock is never available.
- **Reserving without overselling.** Inside `prisma.$transaction` (READ COMMITTED), use an atomic conditional update:
  ```sql
  UPDATE "InventoryBalance"
     SET reserved = reserved + $qty, version = version + 1
   WHERE id = $balanceId
     AND on_hand - reserved - damaged >= $qty
  RETURNING id;
  ```
  Zero rows returned means insufficient stock, and the whole transaction is rolled back with `INSUFFICIENT_STOCK`. Then insert `InventoryReservation` and a `RESERVE` movement.
- Multi-line orders lock balances in a **deterministic order** (sorted by balance id) to avoid deadlocks. When a read-then-decide step is needed (for example, choosing among locations), use `SELECT … FOR UPDATE` on the candidate rows first. On serialization or deadlock errors, retry up to 3 times.
- **Consume** at shipment: `reserved -= q`, `onHand -= q`, plus a `SHIPMENT` movement. **Release** on cancel or expiry: `reserved -= q`, plus a `RELEASE` movement.
- Concurrency test: N parallel checkouts on stock S must produce exactly `floor(S/q)` successes.

## 6. Enterprise programs & allocations

```mermaid
erDiagram
  Organization ||--o{ Program : owns
  Program ||--o{ ProgramItem : includes
  Program ||--o{ ProgramLocation : delivers_to
  ProgramItem ||--o{ Allocation : split
  ProgramLocation ||--o{ Allocation : receives
  Program ||--o{ ProgramMember : managed_by
  Program ||--o{ Order : generates

  Program { string id PK; string organizationId FK; string code; string name; string managerId FK; decimal budget; string currency; date startDate; date deadline; ProgramStatus status }
  ProgramItem { string id PK; string programId FK; string variantId FK; int totalQuantity; decimal unitPriceSnapshot; string kitId FK }
  ProgramLocation { string id PK; string programId FK; string name; json address; string contactName; string contactPhone; date requiredBy; text deliveryNotes }
  Allocation { string id PK; string programItemId FK; string programLocationId FK; int quantity; AllocationStatus status }
```

- Enums: `ProgramStatus(DRAFT, APPROVED, IN_PRODUCTION, FULFILLING, COMPLETED, CANCELLED)`, `AllocationStatus(PLANNED, PICKING, PACKED, SHIPPED, DELIVERED)`.
- Unique: `Program(organizationId, code)`, `Allocation(programItemId, programLocationId)`.
- Index: `Program(organizationId, status)`.
- **Allocation rule:** for each `ProgramItem`, Σ `Allocation.quantity` ≤ `totalQuantity`. The rule is enforced in the service inside a transaction that locks the program item with `SELECT … FOR UPDATE`. Budget rule: Σ (item qty × unit price) ≤ `budget`, giving a warning or a hard stop depending on configuration.

## 7. Production & quality control

```mermaid
erDiagram
  ProductionJob ||--o{ ProductionMilestone : tracks
  ProductionJob ||--o{ ProductionMedia : documents
  ProductionJob ||--o{ QualityInspection : inspected_by
  QualityInspection ||--o{ InspectionAttachment : has
  QualityInspection ||--o{ InspectionDefect : finds
  ProductionJob }o--|| Supplier : made_by
  ProductionJob }o--|| ProductVariant : makes
  ProductionJob }o--o| Order : for
  ProductionJob }o--o| Program : for

  ProductionJob { string id PK; string number UK; string organizationId FK; string supplierId FK; string variantId FK; string orderId FK; string programId FK; int quantity; ProductionStatus status; date expectedCompletion; string artworkFileId FK }
  ProductionMilestone { string id PK; string jobId FK; MilestoneType type; MilestoneStatus status; date dueAt; datetime completedAt; string note }
  ProductionMedia { string id PK; string jobId FK; string fileId FK; string caption; bool visibleToCustomer }
  QualityInspection { string id PK; string jobId FK; InspectionKind kind; string inspectorId FK; datetime inspectedAt; InspectionResult result; ApprovalStatus approvalStatus; string approvedById FK; int sampleSize; int defectsFound; text notes }
  InspectionAttachment { string id PK; string inspectionId FK; string fileId FK }
```

- Enums: `ProductionStatus(PENDING, SAMPLE_IN_PROGRESS, SAMPLE_REVIEW, APPROVED_FOR_PRODUCTION, IN_PRODUCTION, QC, COMPLETED, ON_HOLD, CANCELLED)`, `MilestoneType(ARTWORK_APPROVED, MATERIALS_SOURCED, SAMPLE_READY, PRODUCTION_STARTED, PRODUCTION_FINISHED, QC_PASSED, SHIPPED_TO_WAREHOUSE)`, `InspectionKind(SAMPLE, IN_LINE, FINAL)`, `InspectionResult(PASS, FAIL, CONDITIONAL)`, `ApprovalStatus(PENDING, APPROVED, REJECTED)`.
- Workflow: the `SAMPLE` inspection is approved (by staff QC and/or the customer) → status `APPROVED_FOR_PRODUCTION`. The `FINAL` inspection `PASS` + approval → `COMPLETED`, which allows a goods receipt into the warehouse.
- Index: `ProductionJob(organizationId, status)`, `ProductionJob(supplierId)`.

## 8. Kitting, fulfillment & shipping

```mermaid
erDiagram
  Kit ||--o{ KitComponent : contains
  ProductVariant ||--o{ KitComponent : component
  KitAssembly }o--|| Kit : builds
  FulfillmentOrder ||--o{ FulfillmentLine : has
  FulfillmentOrder ||--o{ PickList : picked_via
  PickList ||--o{ PickListLine : has
  FulfillmentOrder ||--o{ Package : packed_into
  Package ||--o{ PackageItem : contains
  Shipment ||--o{ Package : carries
  Shipment ||--o{ TrackingEvent : tracked_by
  Order ||--o{ FulfillmentOrder : fulfilled_by
  ProgramLocation ||--o{ FulfillmentOrder : destination

  Kit { string id PK; string organizationId FK; string sku UK; string name; bool isCustom }
  KitComponent { string id PK; string kitId FK; string variantId FK; int quantity }
  KitAssembly { string id PK; string kitId FK; string warehouseId FK; int quantity; AssemblyStatus status }
  FulfillmentOrder { string id PK; string number UK; string organizationId FK; string orderId FK; string programLocationId FK; string warehouseId FK; FulfillmentStatus status; json shipTo }
  FulfillmentLine { string id PK; string fulfillmentOrderId FK; string variantId FK; string kitId FK; int quantity; int pickedQty; int packedQty; int shippedQty }
  PickList { string id PK; string fulfillmentOrderId FK; string assigneeId FK; PickStatus status }
  PickListLine { string id PK; string pickListId FK; string balanceId FK; int quantity; int pickedQty }
  Package { string id PK; string fulfillmentOrderId FK; string shipmentId FK; int weightGrams; json dimensions; string labelFileId FK }
  Shipment { string id PK; string organizationId FK; string carrier; string service; string trackingNumber; ShipmentStatus status; datetime shippedAt; datetime deliveredAt; string deliveredTo; string proofFileId FK }
  TrackingEvent { string id PK; string shipmentId FK; string code; string description; string location; datetime occurredAt }
```

- Enums: `AssemblyStatus(PLANNED, IN_PROGRESS, DONE)`, `FulfillmentStatus(PENDING, ALLOCATED, PICKING, PICKED, PACKING, PACKED, PARTIALLY_SHIPPED, SHIPPED, DELIVERED, CANCELLED)`, `PickStatus(OPEN, IN_PROGRESS, DONE)`, `ShipmentStatus(LABEL_CREATED, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, EXCEPTION, RETURNED)`.
- Unique: `KitComponent(kitId, variantId)`, `Shipment(carrier, trackingNumber)`.
- Checks: `pickedQty ≤ quantity`, `packedQty ≤ pickedQty`, `shippedQty ≤ packedQty`.
- **Partial shipments:** each fulfillment order can have many shipments.
- **Kit assembly** posts `KIT_CONSUME` movements for the components and `KIT_PRODUCE` for the kit SKU, in one transaction.

## 9. CRM, notifications, analytics & audit

```mermaid
erDiagram
  Lead ||--o{ Activity : has
  Organization ||--o{ Activity : has
  ConsultationBooking }o--o| Lead : from
  User ||--o{ Notification : receives
  AuditLog }o--o| User : actor
  FileObject }o--o| Organization : owned_by

  Lead { string id PK; string name; string email; string phone; string company; LeadSource source; LeadStatus status; string ownerId FK; text message }
  Activity { string id PK; string leadId FK; string organizationId FK; ActivityType type; text body; string actorId FK }
  ConsultationBooking { string id PK; string leadId FK; datetime slotStart; int durationMin; BookingStatus status; string topic }
  Notification { string id PK; string userId FK; string organizationId FK; NotificationChannel channel; string template; json payload; datetime readAt; NotifStatus status }
  AuditLog { string id PK; string actorId FK; string organizationId FK; string action; string entityType; string entityId; json before; json after; string ip; string requestId; datetime createdAt }
  FileObject { string id PK; string organizationId FK; string bucket; string key UK; string mime; int size; string sha256; FileStatus status; FileVisibility visibility }
  NewsletterSubscriber { string id PK; string email UK; datetime confirmedAt; datetime unsubscribedAt }
```

- Enums: `LeadSource(WEBSITE_CONTACT, QUOTE, CONSULTATION, NEWSLETTER, WHATSAPP, REFERRAL)`, `LeadStatus(NEW, CONTACTED, QUALIFIED, WON, LOST)`, `ActivityType(NOTE, CALL, EMAIL, MEETING, WHATSAPP)`, `BookingStatus(REQUESTED, CONFIRMED, CANCELLED, DONE)`, `NotificationChannel(EMAIL, SMS, WHATSAPP, IN_APP)`, `NotifStatus(QUEUED, SENT, FAILED)`, `FileStatus(PENDING, READY, REJECTED)`, `FileVisibility(PUBLIC, PRIVATE)`.
- Index: `AuditLog(entityType, entityId)`, `AuditLog(organizationId, createdAt)`, `Notification(userId, readAt)`.
- `AuditLog` is append-only, with the same DB protections as the inventory ledger.
- Analytics uses read-only SQL views and materialized views (sales by period, org, category; inventory turnover; on-time delivery rate; QC pass rate), refreshed by a scheduled job.
