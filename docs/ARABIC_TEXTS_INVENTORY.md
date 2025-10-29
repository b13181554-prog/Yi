# جرد النصوص العربية (Arabic Texts Inventory)

هذا الملف يحتوي على جميع النصوص العربية المستخدمة في واجهات المستخدم، منظمة حسب الـ namespaces.

---

## 1. Namespace: `dashboard`

### عناوين الصفحة والأقسام (Page & Section Titles)

| Key | Arabic Text | Context | Line |
|-----|-------------|---------|------|
| `page_title` | لوحة التحكم - OBENTCHI Trading Bot | Page title tag | 6 |
| `header_title` | لوحة التحكم | Main page heading | 284 |
| `section_resources` | استخدام الموارد | Resources section title | 402 |
| `section_recommendations` | التوصيات | Recommendations section title | 433 |

### حالات ومؤشرات (Status & Indicators)

| Key | Arabic Text | Context | Line |
|-----|-------------|---------|------|
| `status_live` | مباشر | Live status indicator | 289 |
| `btn_refresh` | تحديث | Refresh button | 291 |
| `loading_message` | جاري تحميل البيانات... | Initial loading message | 296 |

### بطاقات الإحصائيات (Stats Cards)

| Key | Arabic Text | Context | Line |
|-----|-------------|---------|------|
| `stat_username` | اسم المستخدم | Username stat title | 356 |
| `stat_username_unavailable` | غير متوفر | When username not available | 359 |
| `stat_tier` | المستوى | User tier stat title | 365 |
| `stat_tier_description` | مستوى الاشتراك الحالي | Tier description | 371 |
| `stat_balance` | الرصيد | Balance stat title | 376 |
| `stat_balance_description` | الرصيد المتاح | Balance description | 380 |
| `stat_subscription` | الاشتراك | Subscription stat title | 385 |
| `stat_subscription_days_suffix` | يوم | Days suffix for subscription | 390 |
| `stat_subscription_inactive` | غير نشط | When no active subscription | 391 |
| `stat_subscription_expires_prefix` | ينتهي في | Expiry date prefix | 395 |
| `stat_subscription_none` | لا يوجد اشتراك نشط | No active subscription | 396 |

### الموارد (Resources)

| Key | Arabic Text | Context | Line |
|-----|-------------|---------|------|
| `resource_unlimited` | غير محدود | When resource has no limit | 408 |
| `resource_remaining_suffix` | متبقي | Remaining resource suffix | 417 |
| `resource_analysis` | التحليل الفني | Technical analysis resource | 456 |
| `resource_market_data` | بيانات السوق | Market data resource | 457 |
| `resource_search` | البحث | Search resource | 458 |
| `resource_ai` | الذكاء الاصطناعي | AI resource | 459 |
| `resource_scanner` | ماسح السوق | Market scanner resource | 460 |

### الأولويات (Priorities)

| Key | Arabic Text | Context | Line |
|-----|-------------|---------|------|
| `priority_high` | أولوية عالية | High priority | 467 |
| `priority_medium` | أولوية متوسطة | Medium priority | 468 |
| `priority_low` | نصيحة | Low priority / tip | 469 |

### أزرار الإجراءات (Action Buttons)

| Key | Arabic Text | Context | Line |
|-----|-------------|---------|------|
| `action_subscribe` | الاشتراك الآن | Subscribe now action | 476 |
| `action_upgrade_or_wait` | انتظر أو ترقّى | Upgrade or wait action | 477 |
| `action_become_analyst` | كن محللاً | Become analyst action | 478 |
| `action_default` | اتخاذ إجراء | Default action text | 480 |

### رسائل الأخطاء والتنبيهات (Error & Alert Messages)

| Key | Arabic Text | Context | Line |
|-----|-------------|---------|------|
| `error_telegram_required` | يرجى فتح لوحة التحكم من داخل Telegram Bot | When opened outside Telegram | 322 |
| `error_no_user_id` | معرف المستخدم غير موجود | When user ID is missing | 330 |
| `error_loading_data` | خطأ في تحميل البيانات | Data loading error | 339 |
| `alert_feature_coming_soon` | سيتم تطبيق هذه الميزة قريباً! | Feature coming soon alert | 485 |

---

## 2. Namespace: `admin_dashboard`

### عناوين الصفحة والأقسام (Page & Section Titles)

| Key | Arabic Text | Context | Line |
|-----|-------------|---------|------|
| `page_title` | لوحة تحكم الإدارة - OBENTCHI | Page title tag | 6 |
| `header_title` | لوحة تحكم الإدارة | Main page heading | 228 |
| `section_tier_distribution` | توزيع المستويات (Tiers) | Tier distribution section | 281 |
| `section_violations` | أكثر المستخدمين انتهاكاً | Top violators section | 286 |

### حالات الاتصال (Connection Status)

| Key | Arabic Text | Context | Line |
|-----|-------------|---------|------|
| `status_connected` | متصل | Connected status | 237, 353 |
| `status_disconnected` | غير متصل | Disconnected status | 344 |

### بطاقات الإحصائيات (Stats Cards)

| Key | Arabic Text | Context | Line |
|-----|-------------|---------|------|
| `stat_total_users` | إجمالي المستخدمين | Total users stat | 244 |
| `stat_total_users_description` | جميع المستخدمين المسجلين | Total users description | 246 |
| `stat_active_subscriptions` | اشتراكات نشطة | Active subscriptions stat | 250 |
| `stat_active_subscriptions_description` | مستخدمون لديهم اشتراك نشط | Active subscriptions description | 252 |
| `stat_active_analysts` | محللون نشطون | Active analysts stat | 256 |
| `stat_active_analysts_description` | محللون معتمدون ونشطون | Active analysts description | 258 |
| `stat_recent_transactions` | معاملات حديثة | Recent transactions stat | 262 |
| `stat_recent_transactions_description` | آخر 24 ساعة | Last 24 hours | 264 |
| `stat_live_connections` | اتصالات مباشرة | Live connections stat | 268 |
| `stat_live_connections_description` | مستخدمون متصلون حالياً | Currently connected users | 270 |
| `stat_violations` | انتهاكات الحدود | Violations stat | 274 |
| `stat_violations_description` | محاولات تجاوز الحدود | Violations description | 276 |

### التحديثات والبيانات (Updates & Data)

| Key | Arabic Text | Context | Line |
|-----|-------------|---------|------|
| `last_update_prefix` | آخر تحديث: | Last update prefix | 291, 339 |
| `last_update_default` | -- | Default when no update | 291 |
| `data_empty_state` | لا توجد بيانات | No data available | 376 |
| `violations_empty_state` | لا توجد انتهاكات | No violations | 408 |
| `user_label` | مستخدم: | User label in violations | 420 |
| `user_count_suffix` | مستخدم | User count suffix | 391 |
| `violation_suffix` | انتهاك | Violation suffix | 421 |

### رسائل الأخطاء (Error Messages)

| Key | Arabic Text | Context | Line |
|-----|-------------|---------|------|
| `error_telegram_required` | يرجى فتح لوحة التحكم من داخل Telegram Bot | When opened outside Telegram | 315 |

---

## 3. Namespace: `admin_feature_control`

### عناوين الصفحة والأقسام (Page & Section Titles)

| Key | Arabic Text | Context | Line |
|-----|-------------|---------|------|
| `page_title` | لوحة التحكم في الميزات - OBENTCHI | Page title tag | 6 |
| `header_title` | لوحة التحكم الديناميكي في الميزات | Main page heading | 224 |
| `header_subtitle` | تحكم في جميع ميزات النظام بدون إعادة تشغيل | Page subtitle | 225 |
| `section_features_list` | قائمة الميزات | Features list section | 264 |

### بطاقات الإحصائيات (Stats Cards)

| Key | Arabic Text | Context | Line |
|-----|-------------|---------|------|
| `stat_total_features` | إجمالي الميزات | Total features stat | 230 |
| `stat_enabled_features` | ميزات مفعّلة | Enabled features stat | 234 |
| `stat_disabled_features` | ميزات معطلة | Disabled features stat | 238 |

### أزرار التحكم (Control Buttons)

| Key | Arabic Text | Context | Line |
|-----|-------------|---------|------|
| `btn_add_feature` | إضافة ميزة جديدة | Add new feature button | 244 |
| `btn_refresh` | تحديث | Refresh button | 245 |

### الفلاتر (Filters)

| Key | Arabic Text | Context | Line |
|-----|-------------|---------|------|
| `filter_all_scopes` | جميع النطاقات | All scopes filter option | 249 |
| `filter_scope_global` | عام (Global) | Global scope option | 250, 286 |
| `filter_scope_tier` | حسب الفئة (Tier) | Tier scope option | 251, 287 |
| `filter_scope_user` | حسب المستخدم (User) | User scope option | 252, 288 |
| `filter_all_statuses` | جميع الحالات | All statuses filter | 256 |
| `filter_enabled_only` | مفعّل فقط | Enabled only filter | 257 |
| `filter_disabled_only` | معطل فقط | Disabled only filter | 258 |

### نافذة إضافة ميزة (Add Feature Modal)

| Key | Arabic Text | Context | Line |
|-----|-------------|---------|------|
| `modal_title_add` | إضافة ميزة جديدة | Add feature modal title | 274 |
| `label_feature_key` | مفتاح الميزة (Key) * | Feature key label | 279 |
| `placeholder_feature_key` | مثال: ultra_analysis | Feature key placeholder | 280 |
| `label_scope` | النطاق (Scope) * | Scope label | 284 |
| `label_target` | الهدف (Target) * | Target label | 293 |
| `placeholder_target` | مثال: vip أو user_id | Target placeholder | 294 |
| `label_enabled` | مفعّل | Enabled checkbox label | 300 |
| `label_rollout_percentage` | نسبة الطرح (%) - اختياري | Rollout percentage label | 305 |
| `label_description` | الوصف - اختياري | Description label | 310 |
| `placeholder_description` | وصف الميزة | Description placeholder | 311 |
| `btn_save_feature` | حفظ الميزة | Save feature button | 314 |
| `btn_cancel` | إلغاء | Cancel button | 315 |

### جدول الميزات (Features Table)

| Key | Arabic Text | Context | Line |
|-----|-------------|---------|------|
| `table_header_key` | المفتاح | Key column header | 379 |
| `table_header_scope` | النطاق | Scope column header | 380 |
| `table_header_target` | الهدف | Target column header | 381 |
| `table_header_status` | الحالة | Status column header | 382 |
| `table_header_rollout` | نسبة الطرح | Rollout column header | 383 |
| `table_header_updated` | آخر تحديث | Last updated column header | 384 |
| `table_header_actions` | الإجراءات | Actions column header | 385 |

### حالات الميزة (Feature Status)

| Key | Arabic Text | Context | Line |
|-----|-------------|---------|------|
| `status_enabled` | مفعّل | Enabled status badge | 393 |
| `status_disabled` | معطل | Disabled status badge | 394 |

### أزرار الإجراءات (Action Buttons)

| Key | Arabic Text | Context | Line |
|-----|-------------|---------|------|
| `btn_disable` | تعطيل | Disable button | 411 |
| `btn_enable` | تفعيل | Enable button | 411 |

### رسائل النجاح والأخطاء (Success & Error Messages)

| Key | Arabic Text | Context | Line |
|-----|-------------|---------|------|
| `loading_message` | جارِ التحميل... | Loading message | 266 |
| `error_load_failed` | فشل تحميل البيانات | Failed to load data | 359 |
| `error_server_connection` | خطأ في الاتصال بالخادم | Server connection error | 364, 451, 477, 561 |
| `empty_no_features` | لا توجد ميزات | No features available | 371 |
| `success_feature_updated` | تم تحديث الميزة بنجاح | Feature updated successfully | 444 |
| `error_feature_update_failed` | فشل تحديث الميزة | Failed to update feature | 447 |
| `confirm_delete_feature` | هل أنت متأكد من حذف الميزة "${key}"؟ | Delete confirmation | 456 |
| `success_feature_deleted` | تم حذف الميزة بنجاح | Feature deleted successfully | 470 |
| `error_feature_delete_failed` | فشل حذف الميزة | Failed to delete feature | 473 |
| `error_key_required` | يرجى إدخال مفتاح الميزة | Key is required | 515 |
| `error_target_required` | يرجى إدخال الهدف | Target is required | 520 |
| `success_feature_created` | تم إنشاء الميزة بنجاح | Feature created successfully | 553 |
| `error_feature_create_failed` | فشل إنشاء الميزة | Failed to create feature | 557 |

---

## 4. Namespace: `admin_feature_flags`

### عناوين الصفحة والأقسام (Page & Section Titles)

| Key | Arabic Text | Context | Line |
|-----|-------------|---------|------|
| `page_title` | إدارة Feature Flags - OBENTCHI | Page title tag | 6 |
| `header_title` | إدارة Feature Flags | Main page heading | 412 |

### أزرار التنقل والإجراءات (Navigation & Action Buttons)

| Key | Arabic Text | Context | Line |
|-----|-------------|---------|------|
| `btn_back_to_dashboard` | رجوع للوحة التحكم | Back to dashboard button | 416 |
| `btn_add_flag` | إضافة Flag جديد | Add new flag button | 419 |

### بطاقات الإحصائيات (Stats Cards)

| Key | Arabic Text | Context | Line |
|-----|-------------|---------|------|
| `stat_total_flags` | إجمالي Flags | Total flags stat | 426 |
| `stat_enabled_flags` | Flags مفعّلة | Enabled flags stat | 430 |
| `stat_disabled_flags` | Flags معطّلة | Disabled flags stat | 434 |
| `stat_global_flags` | Global Flags | Global flags stat | 438 |

### الفلاتر (Filters)

| Key | Arabic Text | Context | Line |
|-----|-------------|---------|------|
| `filter_search_label` | بحث | Search filter label | 445 |
| `filter_search_placeholder` | ابحث عن Flag... | Search placeholder | 446 |
| `filter_scope_label` | النطاق (Scope) | Scope filter label | 449 |
| `filter_scope_all` | الكل | All scopes option | 451 |
| `filter_status_label` | الحالة | Status filter label | 458 |
| `filter_status_enabled` | مفعّل | Enabled status option | 461 |
| `filter_status_disabled` | معطّل | Disabled status option | 462 |
| `btn_clear_filters` | مسح الفلاتر | Clear filters button | 466 |

### جدول Feature Flags (Feature Flags Table)

| Key | Arabic Text | Context | Line |
|-----|-------------|---------|------|
| `table_header_key` | المفتاح | Key column header | 474 |
| `table_header_scope` | النطاق | Scope column header | 475 |
| `table_header_target` | الهدف | Target column header | 476 |
| `table_header_status` | الحالة | Status column header | 477 |
| `table_header_rollout` | نسبة الطرح | Rollout column header | 478 |
| `table_header_updated` | آخر تحديث | Last updated column header | 479 |
| `table_header_actions` | الإجراءات | Actions column header | 480 |

### حالات التحميل والبيانات (Loading & Data States)

| Key | Arabic Text | Context | Line |
|-----|-------------|---------|------|
| `loading_message` | جاري التحميل... | Loading message | 486 |
| `empty_no_flags` | لا توجد Feature Flags بعد | No flags available | 626 |

### نافذة إضافة/تعديل Flag (Add/Edit Flag Modal)

| Key | Arabic Text | Context | Line |
|-----|-------------|---------|------|
| `modal_title_add` | إضافة Feature Flag جديد | Add flag modal title | 499 |
| `label_key` | المفتاح (Key) * | Key label | 504 |
| `placeholder_key` | مثال: new_feature | Key placeholder | 505 |
| `label_scope` | النطاق (Scope) * | Scope label | 509 |
| `option_scope_global` | Global - لجميع المستخدمين | Global scope option | 511 |
| `option_scope_tier` | Tier - لمستوى معين | Tier scope option | 512 |
| `option_scope_user` | User - لمستخدم محدد | User scope option | 513 |
| `label_target` | الهدف (Target) * | Target label | 518 |
| `label_enabled` | مفعّل | Enabled checkbox label | 525 |
| `label_rollout_percentage` | نسبة الطرح التدريجي (Rollout %) | Rollout percentage label | 530 |
| `help_rollout` | سيتم تطبيق الـ flag على نسبة من المستخدمين فقط | Rollout help text | 535 |
| `label_description` | الوصف (اختياري) | Description label | 540 |
| `placeholder_description` | وصف الميزة... | Description placeholder | 541 |
| `btn_cancel` | إلغاء | Cancel button | 545 |
| `btn_save` | حفظ | Save button | 546 |

### أزرار الإجراءات (Action Buttons)

| Key | Arabic Text | Context | Line |
|-----|-------------|---------|------|
| `btn_edit` | تعديل | Edit button | 650 |
| `btn_disable` | تعطيل | Disable button | 654 |
| `btn_enable` | تفعيل | Enable button | 654 |
| `btn_delete` | حذف | Delete button | 657 |

### الترقيم (Pagination)

| Key | Arabic Text | Context | Line |
|-----|-------------|---------|------|
| `btn_previous` | السابق | Previous page button | 677 |

### رسائل النجاح والأخطاء (Success & Error Messages)

| Key | Arabic Text | Context | Line |
|-----|-------------|---------|------|
| `error_server_connection` | خطأ في الاتصال بالخادم | Server connection error | 571 |
| `error_load_failed` | خطأ في تحميل البيانات | Failed to load data | 610 |

### حالات الميزة (Feature Status)

| Key | Arabic Text | Context | Line |
|-----|-------------|---------|------|
| `status_enabled` | مفعّل | Enabled status | 644 |
| `status_disabled` | معطّل | Disabled status | 644 |

---

## ملاحظات إضافية (Additional Notes)

### أنماط التسمية (Naming Conventions)
- استخدمت `snake_case` لجميع المفاتيح باللغة الإنجليزية
- تم تجميع النصوص حسب السياق (headers, stats, buttons, errors, etc.)
- النصوص المتكررة في عدة ملفات تم توثيقها في كل namespace

### نصوص ديناميكية (Dynamic Texts)
بعض النصوص يتم إنشاؤها ديناميكياً في JavaScript وتحتوي على متغيرات:
- `${user.username}` - اسم المستخدم
- `${tier_name}` - اسم المستوى
- `${balance}` - الرصيد
- `${days}` - عدد الأيام
- `${key}` - مفتاح الميزة

### توصيات للاستخدام (Usage Recommendations)
1. يمكن استخدام هذا الجرد لإنشاء نظام ترجمة (i18n)
2. يساعد في توحيد النصوص المستخدمة عبر التطبيق
3. يسهل تحديث وصيانة النصوص العربية
4. يمكن تحويله إلى ملفات JSON للاستخدام في نظام الترجمة

### إحصائيات (Statistics)

| Namespace | عدد النصوص |
|-----------|------------|
| `dashboard` | ~35 نص |
| `admin_dashboard` | ~25 نص |
| `admin_feature_control` | ~40 نص |
| `admin_feature_flags` | ~45 نص |
| **الإجمالي** | **~145 نص عربي** |
