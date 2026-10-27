# Grdlabs: نسخة الآيفون

هذا الملف يشرح كل ملفات تطبيق الآيفون: التصميم، والألوان، والأيقونات، والبرمجة، والربط مع Firebase وبرنامج الحاسوب، وشلون تبنيه وترفعه على App Store.

## معلومات التطبيق

| | |
|---|---|
| الاسم | Grdlabs |
| معرّف التطبيق (Bundle ID) | `site.grdlabs.app` |
| الإصدار | 1.0.0 |
| مشروع Expo | `@grdlabs/grdlabs-mobile` |
| أقل إصدار iOS | 15.1 |
| اللغة والاتجاه | عربي، من اليمين لليسار |

## الملفات

```
Grdlabs-Mobile/
  ios/                      مشروع Xcode جاهز (Grdlabs.xcodeproj + Podfile)
  App.tsx                   تشغيل التطبيق: الشاشات، والربط، ومسح رمز الربط
  src/
    web/appHtml.ts          كل شاشات التطبيق بالتصميم (تتولّد تلقائياً، لا تعدّلها بيدك)
    screens/WebHost.tsx     يعرض الشاشات، ويوصلها بـ Firebase وNFC وFace ID والموقع
    screens/Auth.tsx        الربط برمز الشركة (الكاميرا) والتسجيل
    account.ts              الربط مع Firebase: الدخول، والراتب، والحضور
    device.ts               Face ID، والموقع، وقراءة ملصق NFC
    reminders.ts            إشعارات المهام على التلفون
    firebase.ts, config.ts  إعدادات Firebase (مشروع grdlabs)
    theme.ts                ألوان الوضع الفاتح والداكن
  scripts/
    build-web.mjs           يبني الشاشات من ملف التصميم ويضيف عليه الميزات
    web/                    كود المشاريع والهدف للفري لانسر
  reference/
    prototype.html          ملف التصميم الأصلي (Liquid Glass)
    firestore.rules         قواعد حماية Firebase
  assets/                   الأيقونة، وشاشة البداية، وشعار التطبيق
  app.json                  إعدادات التطبيق: الاسم، والمعرّف، والأذونات، وNFC، وFace ID
  eas.json                  إعدادات البناء على سيرفرات Expo
```

## الألوان (من التصميم)

| الاستخدام | الوضع الفاتح | الوضع الداكن |
|---|---|---|
| الخلفية | `#E9EDF5` | `#07080C` |
| اللون الأساسي (أزرق) | `#007AFF` | `#0A84FF` |
| أخضر (حضور، مدفوع) | `#34C759` | `#30D158` |
| أحمر (خصم، متأخر) | `#FF3B30` | `#FF453A` |
| برتقالي (سلفة، تنبيه) | `#FF9500` | `#FF9F0A` |
| بنفسجي (الفري لانسر) | `#AF52DE` | `#BF5AF2` |
| النص | `#0B0B0F` | `#F5F5F7` |
| الزجاج | `rgba(255,255,255,.50)` | `rgba(44,44,52,.42)` |

الخط: Noto Sans Arabic، ومعه خط الآيفون (SF Arabic). القائمة الكاملة للألوان موجودة أعلى `reference/prototype.html`.

## الأيقونة والشعار

- أيقونة الآيفون: `assets/icon.png` (1024×1024، بدون حواف شفافة)، ونسختها داخل `ios/Grdlabs/Images.xcassets/AppIcon.appiconset/`
- المصدر: `assets/icon-source.svg` (العلامة الخضراء الزجاجية)
- شاشة البداية: `assets/splash-icon.png`

## الربط

- **Firebase (مشروع `grdlabs`):** الدخول بالإيميل، وبيانات الموظف (`att/{company}/staff`)، وتسجيل الحضور (`att/{company}/events`). القواعد موجودة بـ `reference/firestore.rules`.
- **برنامج الحاسوب:** يطلّع رمز الربط (QR) وملصق NFC بالشكل `https://grdlabs.site/app/#p=…` و `#t=…`، والتطبيق يقراهن.
- **حتى تفتح روابط grdlabs.site التطبيق مباشرة:** ارفع `site-files/.well-known/apple-app-site-association` لموقع grdlabs.site، بعد ما تبدّل `TEAMID` بـ Team ID مالتك.
- **الفري لانسر وصاحب الشركة:** بياناتهم تنحفظ على التلفون (فواتير، مشاريع، مهام، مصاريف).

## البناء

### الطريقة الأسهل: سيرفرات Expo (ما تحتاج Xcode)

```bash
npm install
```
```bash
npx eas-cli build --platform ios --profile production
```
يطلب منك تسجل دخول بحساب Apple Developer. وبعد ما يخلص:
```bash
npx eas-cli submit --platform ios --latest
```
بعدها التطبيق يوصل لـ TestFlight وApp Store Connect.

### بـ Xcode على ماك

يحتاج Xcode 16 أو أحدث وCocoaPods:
```bash
npm install
```
```bash
cd ios && pod install
```
افتح `ios/Grdlabs.xcworkspace` بـ Xcode، وبعدين Signing & Capabilities، واختار الـ Team مالتك، وشغّله على الآيفون. للنشر: Product، وبعدين Archive، وبعدين Distribute App.

### تعديل الشاشات

إذا عدّلت `reference/prototype.html` أو `scripts/web/`، شغّل هذا الأمر حتى تتحدث الشاشات قبل البناء:
```bash
node scripts/build-web.mjs
```
